output "certificate_arn" {
  description = "Validated ACM certificate ARN."
  value       = var.enabled ? aws_acm_certificate_validation.this[0].certificate_arn : null
}

output "domain_name" {
  description = "Certificate domain name."
  value       = var.enabled ? aws_acm_certificate.this[0].domain_name : null
}
