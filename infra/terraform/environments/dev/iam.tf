data "aws_iam_policy_document" "ec2_assume_role" {
  statement {
    sid     = "AllowEC2AssumeRole"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ec2" {
  name               = "${local.name_prefix}-ec2-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${local.name_prefix}-ec2-profile"
  role = aws_iam_role.ec2.name
}

data "aws_iam_policy_document" "ec2_runtime" {
  statement {
    sid    = "ReadRuntimeSecret"
    effect = "Allow"

    actions = [
      "secretsmanager:GetSecretValue"
    ]

    resources = [
      "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:${var.app_secret_name}*"
    ]
  }

  statement {
    sid    = "GetECRLoginToken"
    effect = "Allow"

    actions = [
      "ecr:GetAuthorizationToken"
    ]

    resources = ["*"]
  }

  statement {
    sid    = "ReadBackendECRRepository"
    effect = "Allow"

    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
      "ecr:DescribeImages",
      "ecr:DescribeRepositories"
    ]

    resources = module.ecr.repository_arns
  }

  statement {
    sid    = "WriteBasicLogs"
    effect = "Allow"

    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogStreams"
    ]

    resources = ["*"]
  }

  statement {
    sid    = "PrivateMediaS3Access"
    effect = "Allow"

    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject",
    ]

    resources = [
      "${module.private_media_bucket.private_media_bucket_arn}/recipes/*",
      "${module.private_media_bucket.private_media_bucket_arn}/profiles/*",
    ]
  }

  statement {
    sid     = "ReadMediaBucketNameParameter"
    effect  = "Allow"
    actions = ["ssm:GetParameter"]
    resources = [
      "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${local.name_prefix}/app-media-bucket-name"
    ]
  }
}

resource "aws_iam_policy" "ec2_runtime" {
  name   = "${local.name_prefix}-ec2-runtime"
  policy = data.aws_iam_policy_document.ec2_runtime.json
}

resource "aws_iam_role_policy_attachment" "ec2_runtime" {
  role       = aws_iam_role.ec2.name
  policy_arn = aws_iam_policy.ec2_runtime.arn
}
