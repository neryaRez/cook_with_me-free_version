module "static_site" {
  source = "../../modules/frontend/static-site"

  name          = local.name_prefix
  bucket_prefix = "${local.name_prefix}-static-site"

  aliases = local.custom_domain_enabled ? [
    local.custom_frontend_domain
  ] : []

  acm_certificate_arn = local.custom_domain_enabled ? aws_acm_certificate_validation.frontend[0].certificate_arn : null

  tags = local.common_tags
}
