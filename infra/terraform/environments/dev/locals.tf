locals {
  name_prefix = "${var.project_name}-${var.environment}"

  backend_repository_name = "backend"

  custom_domain_enabled = (
    var.enable_custom_domain &&
    trimspace(var.root_domain) != "" &&
    trimspace(var.frontend_subdomain) != "" &&
    trimspace(var.route53_dns_role_arn) != ""
  )

  frontend_subdomain_effective = trimspace(var.frontend_subdomain) != "" ? trimspace(var.frontend_subdomain) : "cook"
  custom_frontend_domain       = local.custom_domain_enabled ? "${local.frontend_subdomain_effective}.${trimspace(var.root_domain)}" : null
  custom_frontend_base_url     = local.custom_frontend_domain != null ? "https://${local.custom_frontend_domain}" : null

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
    App         = "cook-with-me"
  }
}
