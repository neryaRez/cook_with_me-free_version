module "private_media_bucket" {
  source = "../../modules/storage/private-media-bucket"

  bucket_name = "${local.name_prefix}-media-${data.aws_caller_identity.current.account_id}-${var.aws_region}"

  # Prefer the explicit public frontend URL; fall back to the CloudFront domain.
  # Never use "*" — uploads must only be accepted from known frontend origins.
  allowed_origins = [
    local.frontend_public_base_url != "" ? local.frontend_public_base_url : local.cloudfront_frontend_base_url
  ]

  tags = local.common_tags
}

resource "aws_ssm_parameter" "app_media_bucket_name" {
  name  = "/${local.name_prefix}/app-media-bucket-name"
  type  = "String"
  value = module.private_media_bucket.private_media_bucket_name
  tags  = local.common_tags
}
