output "github_actions_role_arn" {
  description = "IAM role ARN used by GitHub Actions through OIDC."
  value       = aws_iam_role.github_actions.arn
}

output "github_actions_role_name" {
  description = "IAM role name used by GitHub Actions through OIDC."
  value       = aws_iam_role.github_actions.name
}

output "github_oidc_provider_arn" {
  description = "GitHub Actions OIDC provider ARN."
  value       = local.github_oidc_provider_arn
}

output "tf_state_bucket" {
  description = "Terraform state bucket."
  value       = aws_s3_bucket.terraform_state.bucket
}
