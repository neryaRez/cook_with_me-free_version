data "aws_secretsmanager_secret" "app_runtime" {
  name = var.app_secret_name
}

data "aws_iam_policy_document" "ec2_backend_runtime_permissions" {
  statement {
    sid = "AllowReadRuntimeSecret"

    actions = [
      "secretsmanager:DescribeSecret",
      "secretsmanager:GetSecretValue"
    ]

    resources = [
      data.aws_secretsmanager_secret.app_runtime.arn
    ]
  }

  statement {
    sid = "AllowEcrPull"

    actions = [
      "ecr:GetAuthorizationToken",
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer"
    ]

    resources = ["*"]
  }
}

resource "aws_iam_policy" "ec2_backend_runtime_permissions" {
  name        = "${local.name_prefix}-ec2-backend-runtime"
  description = "Allow EC2 backend host to pull ECR images and read the app runtime secret."
  policy      = data.aws_iam_policy_document.ec2_backend_runtime_permissions.json

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ec2_backend_runtime_permissions" {
  role       = aws_iam_role.ec2.name
  policy_arn = aws_iam_policy.ec2_backend_runtime_permissions.arn
}
