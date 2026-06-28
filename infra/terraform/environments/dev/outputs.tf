output "aws_account_id" {
  description = "AWS account ID."
  value       = data.aws_caller_identity.current.account_id
}

output "aws_region" {
  description = "AWS region."
  value       = var.aws_region
}

output "ecr_repository_urls" {
  description = "ECR repository URLs."
  value       = module.ecr.repository_urls
}

output "ecr_repository_names" {
  description = "ECR repository names."
  value       = module.ecr.repository_names
}

output "backend_ecr_repository_url" {
  description = "Backend ECR repository URL."
  value       = module.ecr.repository_urls[local.backend_repository_name]
}

output "static_site_bucket_name" {
  description = "Frontend static site S3 bucket name."
  value       = module.static_site.bucket_name
}

output "cloudfront_distribution_id" {
  description = "Frontend CloudFront distribution ID."
  value       = module.static_site.cloudfront_distribution_id
}

output "cloudfront_domain_name" {
  description = "Frontend CloudFront domain name."
  value       = module.static_site.cloudfront_domain_name
}

output "frontend_base_url" {
  description = "Frontend base URL."
  value       = local.custom_domain_enabled ? local.custom_frontend_base_url : local.cloudfront_frontend_base_url
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID."
  value       = module.cognito.user_pool_id
}

output "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN."
  value       = module.cognito.user_pool_arn
}

output "cognito_app_client_id" {
  description = "Cognito App Client ID."
  value       = module.cognito.app_client_id
}

output "ec2_instance_profile_name" {
  description = "EC2 instance profile name."
  value       = aws_iam_instance_profile.ec2.name
}

output "ec2_role_name" {
  description = "EC2 IAM role name."
  value       = aws_iam_role.ec2.name
}

output "inspector_enabled" {
  description = "Whether Inspector is enabled."
  value       = module.inspector.enabled
}

output "custom_domain_enabled" {
  description = "Whether custom domain is enabled."
  value       = local.custom_domain_enabled
}

output "custom_frontend_domain" {
  description = "Custom frontend domain."
  value       = local.custom_frontend_domain
}

output "backend_instance_id" {
  description = "Backend EC2 instance ID."
  value       = module.backend_ec2.instance_id
}

output "backend_public_ip" {
  description = "Backend EC2 public IP."
  value       = module.backend_ec2.public_ip
}

output "backend_public_dns" {
  description = "Backend EC2 public DNS."
  value       = module.backend_ec2.public_dns
}

output "backend_image" {
  description = "Backend Docker image expected by EC2."
  value       = local.backend_image
}

output "backend_api_base_url" {
  description = "Backend API base URL through the existing frontend CloudFront distribution."
  value       = local.custom_domain_enabled ? local.custom_frontend_base_url : local.cloudfront_frontend_base_url
}

output "app_media_bucket_name" {
  description = "Private media S3 bucket name."
  value       = module.private_media_bucket.private_media_bucket_name
}

output "app_media_bucket_arn" {
  description = "Private media S3 bucket ARN."
  value       = module.private_media_bucket.private_media_bucket_arn
}
