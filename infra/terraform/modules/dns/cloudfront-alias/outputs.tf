output "a_record_fqdn" {
  description = "A record FQDN."
  value       = var.enabled ? aws_route53_record.a[0].fqdn : null
}

output "aaaa_record_fqdn" {
  description = "AAAA record FQDN."
  value       = var.enabled ? aws_route53_record.aaaa[0].fqdn : null
}
