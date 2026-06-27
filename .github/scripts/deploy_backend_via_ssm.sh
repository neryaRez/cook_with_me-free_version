#!/usr/bin/env bash
set -euo pipefail

required_vars=(
  INSTANCE_ID
  AWS_REGION
  BACKEND_ECR_REPOSITORY_URL
  SECRET_NAME
  FRONTEND_URL
  COGNITO_USER_POOL_ID
  COGNITO_APP_CLIENT_ID
)

for name in "${required_vars[@]}"; do
  if [ -z "${!name:-}" ]; then
    echo "::error::Missing required env var: $name"
    exit 1
  fi
done

ECR_REGISTRY="$(echo "$BACKEND_ECR_REPOSITORY_URL" | cut -d/ -f1)"
BACKEND_IMAGE="$BACKEND_ECR_REPOSITORY_URL:latest"

cat > /tmp/cook-ssm-script.sh <<'SSM_SCRIPT'
set -euo pipefail

APP_DIR="/opt/cook-with-me"
RUNTIME_ENV="$APP_DIR/runtime.env"
COMPOSE_FILE="$APP_DIR/docker-compose.yml"
COMPOSE_ENV="$APP_DIR/.env"

ECR_REGISTRY="__ECR_REGISTRY__"
AWS_REGION="__AWS_REGION__"
SECRET_NAME="__SECRET_NAME__"
BACKEND_IMAGE="__BACKEND_IMAGE__"
FRONTEND_URL="__FRONTEND_URL__"
COGNITO_USER_POOL_ID="__COGNITO_USER_POOL_ID__"
COGNITO_APP_CLIENT_ID="__COGNITO_APP_CLIENT_ID__"

echo "=== prepare app dir ==="
mkdir -p "$APP_DIR"
chmod 750 "$APP_DIR"

echo "=== install runtime packages ==="
if ! command -v docker >/dev/null 2>&1; then
  dnf install -y docker jq awscli
else
  dnf install -y jq awscli || true
fi

if ! command -v curl >/dev/null 2>&1; then
  dnf install -y curl-minimal || true
fi

echo "=== start docker ==="
systemctl enable docker
systemctl start docker

echo "=== ensure docker compose plugin ==="
if ! docker compose version >/dev/null 2>&1; then
  mkdir -p /usr/local/lib/docker/cli-plugins
  curl -fsSL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
fi

echo "=== docker versions ==="
docker --version
docker compose version

echo "=== read runtime secret ==="
aws secretsmanager get-secret-value \
  --region "$AWS_REGION" \
  --secret-id "$SECRET_NAME" \
  --query SecretString \
  --output text > /tmp/cook-secret.json

echo "=== write runtime env ==="
{
  echo "DATABASE_URL=$(jq -r '.DATABASE_URL // ""' /tmp/cook-secret.json)"
  echo "OPENAI_API_KEY=$(jq -r '.OPENAI_API_KEY // ""' /tmp/cook-secret.json)"
  echo "CORS_ALLOWED_ORIGINS=$FRONTEND_URL"
  echo "AWS_REGION=$AWS_REGION"
  echo "COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID"
  echo "COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID"
} > "$RUNTIME_ENV"

chmod 600 "$RUNTIME_ENV"
rm -f /tmp/cook-secret.json

echo "=== write compose env ==="
cat > "$COMPOSE_ENV" <<COMPOSE_ENV
BACKEND_IMAGE=$BACKEND_IMAGE
COMPOSE_ENV
chmod 600 "$COMPOSE_ENV"

echo "=== write docker-compose.yml ==="
cat > "$COMPOSE_FILE" <<'COMPOSE'
services:
  backend:
    image: ${BACKEND_IMAGE}
    container_name: cook-with-me-backend
    restart: unless-stopped
    ports:
      - "80:8080"
    env_file:
      - /opt/cook-with-me/runtime.env
    environment:
      PORT: "8080"
      FLASK_ENV: "production"
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://127.0.0.1:8080/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
COMPOSE

cd "$APP_DIR"

echo "=== ecr login ==="
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

echo "=== deploy backend container ==="
docker compose pull
docker compose up -d

echo "=== docker ps ==="
docker ps

echo "=== local health check ==="
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8080/health; then
    echo "Backend local health OK"
    exit 0
  fi

  echo "waiting for backend health ($i/30)"
  docker compose logs --tail=40 backend || true
  sleep 5
done

echo "Backend failed local health check"
docker compose ps || true
docker compose logs --tail=200 backend || true
exit 1
SSM_SCRIPT

python3 - <<PY
from pathlib import Path

p = Path("/tmp/cook-ssm-script.sh")
text = p.read_text()

replacements = {
    "__ECR_REGISTRY__": """$ECR_REGISTRY""",
    "__AWS_REGION__": """$AWS_REGION""",
    "__SECRET_NAME__": """$SECRET_NAME""",
    "__BACKEND_IMAGE__": """$BACKEND_IMAGE""",
    "__FRONTEND_URL__": """$FRONTEND_URL""",
    "__COGNITO_USER_POOL_ID__": """$COGNITO_USER_POOL_ID""",
    "__COGNITO_APP_CLIENT_ID__": """$COGNITO_APP_CLIENT_ID""",
}

for old, new in replacements.items():
    text = text.replace(old, new)

p.write_text(text)
PY

SSM_SCRIPT="$(cat /tmp/cook-ssm-script.sh)"

COMMAND_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --comment "Deploy cook-with-me backend" \
  --parameters "$(jq -n --arg script "$SSM_SCRIPT" '{commands:[$script]}')" \
  --query "Command.CommandId" \
  --output text)

echo "SSM command id: $COMMAND_ID"

STATUS="Pending"

for attempt in $(seq 1 90); do
  STATUS=$(aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --query "Status" \
    --output text 2>/dev/null || echo "Pending")

  echo "SSM command status: $STATUS ($attempt/90)"

  if [ "$STATUS" = "Success" ]; then
    break
  fi

  if [ "$STATUS" = "Failed" ] || [ "$STATUS" = "Cancelled" ] || [ "$STATUS" = "TimedOut" ] || [ "$STATUS" = "Cancelling" ]; then
    aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID"
    exit 1
  fi

  sleep 10
done

aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID"

if [ "$STATUS" != "Success" ]; then
  echo "SSM command did not finish successfully before timeout. Last status: $STATUS"
  exit 1
fi
