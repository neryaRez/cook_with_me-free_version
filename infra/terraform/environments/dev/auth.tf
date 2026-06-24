locals {
  # Cognito remains the identity provider.
  # The user experience should be implemented in React custom pages,
  # not locked into Cognito Hosted UI styling.
  cloudfront_frontend_base_url = "https://${module.static_site.cloudfront_domain_name}"

  frontend_base_urls = compact(concat(
    [local.cloudfront_frontend_base_url],
    local.custom_domain_enabled ? [local.custom_frontend_base_url] : []
  ))

  cognito_callback_urls = [
    for url in local.frontend_base_urls : "${url}/auth/callback"
  ]

  cognito_logout_urls = local.frontend_base_urls
}

module "cognito" {
  source = "../../modules/auth/cognito"

  user_pool_name  = "${local.name_prefix}-users"
  app_client_name = "${local.name_prefix}-web-client"
  domain_prefix   = local.name_prefix
  aws_region      = var.aws_region

  callback_urls = local.cognito_callback_urls
  logout_urls   = local.cognito_logout_urls

  # Keep Hosted UI CSS intentionally minimal.
  # React pages should own the real visual design.
  ui_custom_css = ""

  tags = local.common_tags
}
