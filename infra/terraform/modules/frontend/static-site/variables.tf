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
