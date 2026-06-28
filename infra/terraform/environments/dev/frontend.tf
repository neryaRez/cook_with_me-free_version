data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host_header" {
  name = "Managed-AllViewerExceptHostHeader"
}

module "static_site" {
  source = "../../modules/frontend/static-site"

  name          = local.name_prefix
  bucket_prefix = "${local.name_prefix}-static-site"

  aliases = local.custom_domain_enabled ? [
    local.custom_frontend_domain
  ] : []

  acm_certificate_arn = local.custom_domain_enabled ? aws_acm_certificate_validation.frontend[0].certificate_arn : null

  backend_origin_domain_name           = module.backend_ec2.public_dns
  backend_api_cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
  backend_api_origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host_header.id

  tags = local.common_tags
}
