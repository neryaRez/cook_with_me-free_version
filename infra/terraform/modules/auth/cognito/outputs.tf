output "user_pool_id" {
  description = "Cognito User Pool ID."
  value       = aws_cognito_user_pool.this.id
}

output "user_pool_arn" {
  description = "Cognito User Pool ARN."
  value       = aws_cognito_user_pool.this.arn
}

output "user_pool_endpoint" {
  description = "Cognito User Pool endpoint."
  value       = aws_cognito_user_pool.this.endpoint
}

output "app_client_id" {
  description = "Cognito App Client ID."
  value       = aws_cognito_user_pool_client.web.id
}

output "domain_prefix" {
  description = "Cognito Hosted UI domain prefix."
  value       = aws_cognito_user_pool_domain.web.domain
}

output "hosted_ui_base_url" {
  description = "Cognito Hosted UI base URL."
  value       = "https://${aws_cognito_user_pool_domain.web.domain}.auth.${var.aws_region}.amazoncognito.com"
}