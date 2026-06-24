data "aws_route53_zone" "custom_domain" {
  provider = aws.dns
  count    = local.custom_domain_enabled ? 1 : 0

  name         = trimspace(var.root_domain)
  private_zone = false
}

resource "aws_acm_certificate" "frontend" {
  count = local.custom_domain_enabled ? 1 : 0

  domain_name       = local.custom_frontend_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = local.common_tags
}

resource "aws_route53_record" "frontend_cert_validation" {
  provider = aws.dns

  for_each = local.custom_domain_enabled ? {
    for dvo in aws_acm_certificate.frontend[0].domain_validation_options :
    dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  zone_id         = data.aws_route53_zone.custom_domain[0].zone_id
  name            = each.value.name
  type            = each.value.type
  ttl             = 60
  records         = [each.value.record]
}

resource "aws_acm_certificate_validation" "frontend" {
  count = local.custom_domain_enabled ? 1 : 0

  certificate_arn         = aws_acm_certificate.frontend[0].arn
  validation_record_fqdns = [for record in aws_route53_record.frontend_cert_validation : record.fqdn]
}

module "frontend_dns_alias" {
  source = "../../modules/dns/cloudfront-alias"

  providers = {
    aws = aws.dns
  }

  enabled = local.custom_domain_enabled

  zone_id                   = local.custom_domain_enabled ? data.aws_route53_zone.custom_domain[0].zone_id : ""
  domain_name               = local.custom_frontend_domain != null ? local.custom_frontend_domain : ""
  cloudfront_domain_name    = module.static_site.cloudfront_domain_name
  cloudfront_hosted_zone_id = module.static_site.cloudfront_hosted_zone_id
}
