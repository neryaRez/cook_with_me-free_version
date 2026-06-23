#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-cook-with-me-free-version}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
GITHUB_BRANCH_DEFAULT="${GITHUB_BRANCH:-main}"
FRONTEND_SUBDOMAIN_DEFAULT="${FRONTEND_SUBDOMAIN:-cook}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BOOTSTRAP_DIR="$ROOT_DIR/infra/terraform/bootstrap"

clean_name() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9-]/-/g' \
    | sed 's/--*/-/g' \
    | sed 's/^-//' \
    | sed 's/-$//'
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

require_tool() {
  local tool="$1"

  if ! command_exists "$tool"; then
    echo "❌ Missing required tool: $tool"
    exit 1
  fi
}

install_apt_tool_if_missing() {
  local tool="$1"
  local package="$2"

  if command_exists "$tool"; then
    return 0
  fi

  if command_exists apt-get; then
    echo "Installing missing tool: $tool"
    sudo apt-get update -y
    sudo apt-get install -y "$package"
  fi

  require_tool "$tool"
}

install_gh_if_missing() {
  if command_exists gh; then
    return 0
  fi

  echo "GitHub CLI not found. Installing gh..."

  if ! command_exists apt-get; then
    echo "❌ Cannot auto-install GitHub CLI on this OS."
    exit 1
  fi

  sudo apt-get update -y
  sudo apt-get install -y curl ca-certificates gnupg

  sudo mkdir -p -m 755 /etc/apt/keyrings

  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg >/dev/null

  sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | sudo tee /etc/apt/sources.list.d/github-cli.list >/dev/null

  sudo apt-get update -y
  sudo apt-get install -y gh

  require_tool gh
}

detect_github_repository() {
  local remote_url
  remote_url="$(git -C "$ROOT_DIR" remote get-url origin 2>/dev/null || true)"

  if [[ -z "$remote_url" ]]; then
    return 1
  fi

  echo "$remote_url" \
    | sed -E 's#^https://github.com/##' \
    | sed -E 's#^git@github.com:##' \
    | sed -E 's#\.git$##'
}

detect_current_branch() {
  local branch
  branch="$(git -C "$ROOT_DIR" branch --show-current 2>/dev/null || true)"

  if [[ -n "$branch" ]]; then
    echo "$branch"
  else
    echo "$GITHUB_BRANCH_DEFAULT"
  fi
}

detect_github_oidc_provider_arn() {
  aws iam list-open-id-connect-providers \
    --query "OpenIDConnectProviderList[].Arn" \
    --output text 2>/dev/null \
    | tr '\t' '\n' \
    | grep "oidc-provider/token.actions.githubusercontent.com" \
    | head -n 1 || true
}

detect_root_domain_from_route53() {
  aws route53 list-hosted-zones \
    --query "HostedZones[?Config.PrivateZone==\`false\`].Name" \
    --output text 2>/dev/null \
    | tr '\t' '\n' \
    | sed 's/\.$//' \
    | grep -E '^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' \
    | sort \
    | head -n 1 || true
}

put_github_variable() {
  local name="$1"
  local value="$2"

  gh variable set "$name" \
    --repo "$GITHUB_OWNER/$GITHUB_REPO" \
    --body "$value" >/dev/null

  echo "✅ GitHub variable set: $name"
}

runtime_secret_exists() {
  aws secretsmanager describe-secret \
    --secret-id "$SECRET_NAME" \
    --region "$AWS_REGION" >/dev/null 2>&1
}

ensure_runtime_secret() {
  if runtime_secret_exists; then
    echo "✅ Runtime secret already exists: $SECRET_NAME"
    echo "ℹ️ Existing secret value will NOT be overwritten."
    return 0
  fi

  echo
  echo "==> Runtime secrets"
  echo "No existing secret found. Creating a new one."
  echo "These values go to AWS Secrets Manager, not Terraform state."
  echo "Leave empty for mock mode."
  echo

  read -r -p "DATABASE_URL: " DATABASE_URL_VALUE
  read -r -s -p "OPENAI_API_KEY: " OPENAI_API_KEY_VALUE
  echo

  local secret_payload
  secret_payload="$(jq -n \
    --arg openai_api_key "$OPENAI_API_KEY_VALUE" \
    --arg database_url "$DATABASE_URL_VALUE" \
    '{OPENAI_API_KEY: $openai_api_key, DATABASE_URL: $database_url}')"

  aws secretsmanager create-secret \
    --name "$SECRET_NAME" \
    --description "$PROJECT_NAME backend secrets for $ENVIRONMENT" \
    --secret-string "$secret_payload" \
    --region "$AWS_REGION" >/dev/null

  echo "✅ Created runtime secret: $SECRET_NAME"
}

terraform_state_has() {
  local address="$1"
  terraform -chdir="$BOOTSTRAP_DIR" state list 2>/dev/null | grep -qx "$address"
}

import_existing_bootstrap_resources_if_needed() {
  echo "==> Checking existing bootstrap resources..."

  if aws s3api head-bucket --bucket "$TF_STATE_BUCKET" >/dev/null 2>&1; then
    if terraform_state_has "aws_s3_bucket.terraform_state"; then
      echo "✅ tfstate bucket already tracked by Terraform state."
    else
      echo "✅ Existing tfstate bucket found. Importing into Terraform state: $TF_STATE_BUCKET"
      terraform -chdir="$BOOTSTRAP_DIR" import aws_s3_bucket.terraform_state "$TF_STATE_BUCKET"
    fi
  else
    echo "ℹ️ tfstate bucket does not exist yet. Terraform will create it."
  fi

  if aws iam get-role --role-name "$GITHUB_ACTIONS_ROLE_NAME" >/dev/null 2>&1; then
    if terraform_state_has "aws_iam_role.github_actions"; then
      echo "✅ GitHub Actions role already tracked by Terraform state."
    else
      echo "✅ Existing GitHub Actions role found. Importing into Terraform state: $GITHUB_ACTIONS_ROLE_NAME"
      terraform -chdir="$BOOTSTRAP_DIR" import aws_iam_role.github_actions "$GITHUB_ACTIONS_ROLE_NAME"
    fi
  else
    echo "ℹ️ GitHub Actions role does not exist yet. Terraform will create it."
  fi
}

echo
echo "============================================================"
echo "🚀 Cook With Me Free Version AWS Bootstrap"
echo "============================================================"
echo

install_apt_tool_if_missing jq jq
install_apt_tool_if_missing git git
install_gh_if_missing

require_tool aws
require_tool terraform
require_tool jq
require_tool git
require_tool gh

echo "==> Checking AWS identity..."
aws sts get-caller-identity >/dev/null

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
PROJECT_SAFE="$(clean_name "$PROJECT_NAME")"
ENV_SAFE="$(clean_name "$ENVIRONMENT")"

TF_STATE_BUCKET="${TF_STATE_BUCKET:-${PROJECT_SAFE}-${ENV_SAFE}-tfstate-${ACCOUNT_ID}-${AWS_REGION}}"
TF_DEV_STATE_KEY="${TF_DEV_STATE_KEY:-${PROJECT_SAFE}/${ENV_SAFE}/terraform.tfstate}"
SECRET_NAME="${SECRET_NAME:-/${PROJECT_SAFE}/${ENV_SAFE}/app}"
GITHUB_ACTIONS_ROLE_NAME="${GITHUB_ACTIONS_ROLE_NAME:-${PROJECT_SAFE}-${ENV_SAFE}-github-actions-role}"

GITHUB_REPOSITORY_FULL="${GITHUB_REPOSITORY:-$(detect_github_repository || true)}"

if [[ -z "$GITHUB_REPOSITORY_FULL" || "$GITHUB_REPOSITORY_FULL" != */* ]]; then
  echo "❌ Could not detect GitHub repository from git remote."
  echo "Run:"
  echo "  git remote -v"
  echo
  echo "Or pass it manually:"
  echo "  GITHUB_REPOSITORY=owner/repo ./scripts/bootstrap-aws.sh"
  exit 1
fi

GITHUB_OWNER="${GITHUB_REPOSITORY_FULL%%/*}"
GITHUB_REPO="${GITHUB_REPOSITORY_FULL##*/}"
GITHUB_BRANCH="$(detect_current_branch)"

echo "==> Checking GitHub CLI authentication..."
if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Starting gh auth login..."
  gh auth login
fi

echo "==> Detecting Route 53 public hosted zone..."
ROOT_DOMAIN="$(detect_root_domain_from_route53 || true)"

if [[ -n "$ROOT_DOMAIN" ]]; then
  ENABLE_CUSTOM_DOMAIN="true"
  FRONTEND_SUBDOMAIN="$FRONTEND_SUBDOMAIN_DEFAULT"
  FRONTEND_BASE_URL="https://${FRONTEND_SUBDOMAIN}.${ROOT_DOMAIN}"

  echo "✅ Public Route 53 hosted zone detected: $ROOT_DOMAIN"
  echo "✅ Custom domain will be enabled: $FRONTEND_BASE_URL"
else
  ENABLE_CUSTOM_DOMAIN="false"
  FRONTEND_SUBDOMAIN=""
  FRONTEND_BASE_URL=""

  echo "ℹ️ No public Route 53 hosted zone detected."
  echo "ℹ️ App will be deployed with the default CloudFront domain."
fi

echo
echo "==> Detecting GitHub Actions OIDC provider..."
EXISTING_GITHUB_OIDC_PROVIDER_ARN="$(detect_github_oidc_provider_arn || true)"

if [[ -n "$EXISTING_GITHUB_OIDC_PROVIDER_ARN" ]]; then
  CREATE_GITHUB_OIDC_PROVIDER="false"
  echo "✅ Existing GitHub OIDC provider found: $EXISTING_GITHUB_OIDC_PROVIDER_ARN"
else
  CREATE_GITHUB_OIDC_PROVIDER="true"
  EXISTING_GITHUB_OIDC_PROVIDER_ARN=""
  echo "ℹ️ No GitHub OIDC provider found. Terraform bootstrap will create one."
fi

echo
echo "============================================================"
echo "Bootstrap configuration"
echo "============================================================"
echo "Project:              $PROJECT_NAME"
echo "Environment:          $ENVIRONMENT"
echo "AWS region:           $AWS_REGION"
echo "AWS account:          $ACCOUNT_ID"
echo "GitHub repo:          $GITHUB_OWNER/$GITHUB_REPO"
echo "GitHub branch:        $GITHUB_BRANCH"
echo "State bucket:         $TF_STATE_BUCKET"
echo "Dev state key:        $TF_DEV_STATE_KEY"
echo "Secret name:          $SECRET_NAME"
echo "GitHub role name:     $GITHUB_ACTIONS_ROLE_NAME"
echo "Custom domain:        $ENABLE_CUSTOM_DOMAIN"
echo "Root domain:          ${ROOT_DOMAIN:-none}"
echo "Frontend subdomain:   ${FRONTEND_SUBDOMAIN:-none}"
echo "============================================================"
echo

echo "==> Ensuring runtime secret exists..."
ensure_runtime_secret

echo "==> Generating Terraform bootstrap tfvars..."
cat > "$BOOTSTRAP_DIR/terraform.tfvars" <<EOF_TFVARS
project_name                      = "$PROJECT_NAME"
environment                       = "$ENVIRONMENT"
aws_region                        = "$AWS_REGION"
tf_state_bucket                   = "$TF_STATE_BUCKET"
github_owner                      = "$GITHUB_OWNER"
github_repo                       = "$GITHUB_REPO"
github_branch                     = "$GITHUB_BRANCH"
create_github_oidc_provider       = $CREATE_GITHUB_OIDC_PROVIDER
existing_github_oidc_provider_arn = "$EXISTING_GITHUB_OIDC_PROVIDER_ARN"
github_actions_role_name          = "$GITHUB_ACTIONS_ROLE_NAME"
EOF_TFVARS

echo "✅ Generated bootstrap terraform.tfvars"

echo
echo "==> Running Terraform bootstrap..."
terraform -chdir="$BOOTSTRAP_DIR" fmt -recursive
terraform -chdir="$BOOTSTRAP_DIR" init
import_existing_bootstrap_resources_if_needed
terraform -chdir="$BOOTSTRAP_DIR" validate
terraform -chdir="$BOOTSTRAP_DIR" apply -auto-approve

GITHUB_ACTIONS_ROLE_ARN="$(terraform -chdir="$BOOTSTRAP_DIR" output -raw github_actions_role_arn)"
GITHUB_OIDC_PROVIDER_ARN="$(terraform -chdir="$BOOTSTRAP_DIR" output -raw github_oidc_provider_arn)"

echo
echo "==> Writing GitHub repository variables..."
put_github_variable AWS_REGION "$AWS_REGION"
put_github_variable AWS_GITHUB_ACTIONS_ROLE_ARN "$GITHUB_ACTIONS_ROLE_ARN"
put_github_variable TF_STATE_BUCKET "$TF_STATE_BUCKET"
put_github_variable TF_DEV_STATE_KEY "$TF_DEV_STATE_KEY"
put_github_variable PROJECT_NAME "$PROJECT_NAME"
put_github_variable ENVIRONMENT "$ENVIRONMENT"
put_github_variable SECRET_NAME "$SECRET_NAME"
put_github_variable ENABLE_CUSTOM_DOMAIN "$ENABLE_CUSTOM_DOMAIN"
put_github_variable ROOT_DOMAIN "$ROOT_DOMAIN"
put_github_variable FRONTEND_SUBDOMAIN "$FRONTEND_SUBDOMAIN"

echo
echo "============================================================"
echo "✅ Bootstrap completed successfully"
echo "============================================================"
echo "GitHub Actions role:"
echo "$GITHUB_ACTIONS_ROLE_ARN"
echo
echo "GitHub OIDC provider:"
echo "$GITHUB_OIDC_PROVIDER_ARN"
echo
if [[ "$ENABLE_CUSTOM_DOMAIN" == "true" ]]; then
  echo "Custom domain target:"
  echo "$FRONTEND_BASE_URL"
else
  echo "Custom domain disabled. App will use CloudFront default domain."
fi
echo
echo "Next:"
echo "  Build infra/terraform/environments/dev"
echo "  Use S3 backend with use_lockfile=true"
echo "============================================================"
