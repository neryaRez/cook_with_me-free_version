provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# DNS provider for Route53/ACM work, supporting the 3 modes resolved by
# scripts/bootstrap-aws.sh: cloudfront-only (domain disabled, see locals.tf),
# route53-local (zone in this account - role_arn empty, behaves like the
# default provider), route53-cross-account (assumes route53_dns_role_arn).
provider "aws" {
  alias  = "dns"
  region = var.aws_region

  dynamic "assume_role" {
    for_each = trimspace(var.route53_dns_role_arn) != "" ? [trimspace(var.route53_dns_role_arn)] : []
    content {
      role_arn = assume_role.value
    }
  }

  default_tags {
    tags = local.common_tags
  }
}
