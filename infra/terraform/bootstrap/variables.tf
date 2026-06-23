variable "project_name" {
  type        = string
  description = "Project name."
}

variable "environment" {
  type        = string
  description = "Environment name."
}

variable "aws_region" {
  type        = string
  description = "AWS region."
}

variable "tf_state_bucket" {
  type        = string
  description = "Terraform remote state S3 bucket name."
}

variable "github_owner" {
  type        = string
  description = "GitHub repository owner."
}

variable "github_repo" {
  type        = string
  description = "GitHub repository name."
}

variable "github_branch" {
  type        = string
  description = "Main deployment branch."
  default     = "main"
}

variable "create_github_oidc_provider" {
  type        = bool
  description = "Whether Terraform should create the GitHub Actions OIDC provider."
  default     = false
}

variable "existing_github_oidc_provider_arn" {
  type        = string
  description = "Existing GitHub Actions OIDC provider ARN, if one already exists."
  default     = ""
}

variable "github_actions_role_name" {
  type        = string
  description = "GitHub Actions IAM role name."
}
