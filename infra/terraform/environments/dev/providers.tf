provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# Route53 hosted zone lives in the old AWS account.
# Terraform runs in the new app account and assumes this role only for DNS work.
provider "aws" {
  alias  = "dns"
  region = var.aws_region

  assume_role {
    role_arn = var.route53_dns_role_arn
  }

  default_tags {
    tags = local.common_tags
  }
}
