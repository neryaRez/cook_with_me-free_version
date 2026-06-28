variable "project_name" {
  description = "Project name."
  type        = string
  default     = "cook-with-me-free-version"
}

variable "environment" {
  description = "Environment name."
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region."
  type        = string
  default     = "us-east-1"
}

variable "enable_custom_domain" {
  description = "Enable custom domain resources."
  type        = bool
  default     = false
}

variable "root_domain" {
  description = "Root domain, for example nerya.dev."
  type        = string
  default     = ""
}

variable "frontend_subdomain" {
  description = "Frontend subdomain, for example cook."
  type        = string
  default     = "cookwithme"
}

variable "route53_dns_role_arn" {
  description = "Cross-account Route53 role ARN in the old DNS account."
  type        = string
  default     = ""
}

variable "app_secret_name" {
  description = "Secrets Manager secret name used by the backend runtime."
  type        = string
  default     = "/cook-with-me-free-version/dev/app"
}

variable "enable_inspector" {
  description = "Enable Amazon Inspector ECR enhanced scanning."
  type        = bool
  default     = true
}

variable "backend_container_port" {
  description = "Backend container port exposed by Flask/Gunicorn."
  type        = number
  default     = 8080
}

variable "instance_type" {
  description = "EC2 instance type for the Docker host."
  type        = string
  default     = "t3.micro"
}

variable "frontend_public_base_url" {
  description = "Canonical public frontend base URL. Auto-derived by automation from Route53/domain inputs when available."
  type        = string
  default     = ""
}
