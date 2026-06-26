variable "bucket_prefix" {
  type    = string
  default = "fitops-dev-static-site"
}

variable "name" {
  type    = string
  default = "fitops-dev"
}

variable "tags" {
  description = "Tags to apply to all resources created by this module."
  type        = map(string)
  default     = {}
}

variable "aliases" {
  description = "Optional custom domain aliases for CloudFront."
  type        = list(string)
  default     = []
}

variable "acm_certificate_arn" {
  description = "Optional ACM certificate ARN for CloudFront custom aliases."
  type        = string
  default     = null
}

variable "backend_origin_domain_name" {
  description = "Optional backend origin domain name for routing /api/* and /health through the existing frontend CloudFront distribution."
  type        = string
  default     = null
}

variable "backend_api_cache_policy_id" {
  description = "CloudFront cache policy ID for backend API behavior."
  type        = string
  default     = null
}

variable "backend_api_origin_request_policy_id" {
  description = "CloudFront origin request policy ID for backend API behavior."
  type        = string
  default     = null
}
