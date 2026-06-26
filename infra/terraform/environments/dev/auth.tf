locals {
  # Cognito remains the identity provider.
  # Do NOT reference module.static_site here.
  # If a real domain exists, automation passes/derives it.
  # If no domain exists, build_start later aligns Cognito to the created CloudFront default URL.
  cognito_frontend_base_url = local.frontend_public_base_url != "" ? local.frontend_public_base_url : "http://localhost:5173"

  cognito_callback_urls = [
    "${local.cognito_frontend_base_url}/auth/callback"
  ]

  cognito_logout_urls = [
    local.cognito_frontend_base_url
  ]
}

module "cognito" {
  source = "../../modules/auth/cognito"

  user_pool_name  = "${local.name_prefix}-users"
  app_client_name = "${local.name_prefix}-web-client"
  domain_prefix   = local.name_prefix
  aws_region      = var.aws_region

  callback_urls = local.cognito_callback_urls
  logout_urls   = local.cognito_logout_urls

  ui_custom_css = ""

  tags = local.common_tags
}
