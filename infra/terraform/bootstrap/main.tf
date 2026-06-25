data "aws_caller_identity" "current" {}

locals {

  github_oidc_provider_arn = aws_iam_openid_connect_provider.github_actions.arn
  repo_full_name           = "${var.github_owner}/${var.github_repo}"

  allowed_subjects = [
    "repo:${local.repo_full_name}:ref:refs/heads/${var.github_branch}",
    "repo:${local.repo_full_name}:ref:refs/heads/ci/*",
    "repo:${local.repo_full_name}:pull_request"
  ]
}

resource "aws_s3_bucket" "terraform_state" {
  bucket = var.tf_state_bucket

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_iam_openid_connect_provider" "github_actions" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]

  lifecycle {
    prevent_destroy = true
  }
}

data "aws_iam_policy_document" "github_actions_assume_role" {
  statement {
    effect = "Allow"

    actions = [
      "sts:AssumeRoleWithWebIdentity"
    ]

    principals {
      type        = "Federated"
      identifiers = [local.github_oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = local.allowed_subjects
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name               = var.github_actions_role_name
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume_role.json
}

data "aws_iam_policy_document" "github_actions_deploy" {
  statement {
    sid    = "ReadAccountIdentity"
    effect = "Allow"

    actions = [
      "sts:GetCallerIdentity"
    ]

    resources = ["*"]
  }

  statement {
    sid    = "ManageProjectInfrastructure"
    effect = "Allow"

    actions = [
      "acm:*",
      "cloudfront:*",
      "ec2:*",
      "ecr:*",
      "iam:*",
      "route53:*",
      "s3:*",
      "secretsmanager:*",
      "ssm:*",
      "logs:*"
    ]

    resources = ["*"]
  }

  statement {
    sid    = "ManageCognitoAuth"
    effect = "Allow"

    actions = [
      "cognito-idp:CreateUserPool",
      "cognito-idp:DeleteUserPool",
      "cognito-idp:DescribeUserPool",
      "cognito-idp:UpdateUserPool",
      "cognito-idp:ListUserPools",
      "cognito-idp:TagResource",
      "cognito-idp:UntagResource",
      "cognito-idp:ListTagsForResource",
      "cognito-idp:CreateUserPoolDomain",
      "cognito-idp:DeleteUserPoolDomain",
      "cognito-idp:DescribeUserPoolDomain",
      "cognito-idp:UpdateUserPoolDomain",
      "cognito-idp:CreateUserPoolClient",
      "cognito-idp:DeleteUserPoolClient",
      "cognito-idp:DescribeUserPoolClient",
      "cognito-idp:UpdateUserPoolClient",
      "cognito-idp:SetUICustomization",
      "cognito-idp:GetUICustomization"
    ]

    resources = ["*"]
  }

  statement {
    sid    = "ManageInspector"
    effect = "Allow"

    actions = [
      "inspector2:Enable",
      "inspector2:Disable",
      "inspector2:BatchGetAccountStatus",
      "inspector2:ListAccountPermissions",
      "inspector2:ListCoverage",
      "inspector2:ListFindings"
    ]

    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_actions_deploy" {
  name   = "${var.project_name}-${var.environment}-deploy-policy"
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.github_actions_deploy.json
}
