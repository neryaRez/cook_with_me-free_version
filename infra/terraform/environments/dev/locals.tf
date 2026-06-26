locals {
  name_prefix = "${var.project_name}-${var.environment}"

  backend_repository_name = "backend"

  # route53_dns_role_arn is only required for route53-cross-account mode.
  # route53-local mode (hosted zone in this same account) leaves it empty and
  # is still a valid custom-domain configuration - see providers.tf.
  custom_domain_enabled = (
    var.enable_custom_domain &&
    trimspace(var.root_domain) != "" &&
    trimspace(var.frontend_subdomain) != ""
  )

  frontend_subdomain_effective = trimspace(var.frontend_subdomain) != "" ? trimspace(var.frontend_subdomain) : "cook"
  custom_frontend_domain       = local.custom_domain_enabled ? "${local.frontend_subdomain_effective}.${trimspace(var.root_domain)}" : null
  custom_frontend_base_url     = local.custom_frontend_domain != null ? "https://${local.custom_frontend_domain}" : null

  cloudfront_frontend_base_url = "https://${module.static_site.cloudfront_domain_name}"

  frontend_public_base_url = trimspace(var.frontend_public_base_url) != "" ? trimspace(var.frontend_public_base_url) : (
    trimspace(var.root_domain) != "" && trimspace(var.frontend_subdomain) != "" ?
    "https://${local.frontend_subdomain_effective}.${trimspace(var.root_domain)}" :
    ""
  )

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
    App         = "cook-with-me"
  }
}
