variable "enabled" {
  description = "Whether to create Route 53 alias records."
  type        = bool
  default     = false
}

variable "zone_id" {
  description = "Route 53 hosted zone ID."
  type        = string
}

variable "domain_name" {
  description = "Custom domain name to point at CloudFront."
  type        = string
}

variable "cloudfront_domain_name" {
  description = "CloudFront distribution domain name."
  type        = string
}

variable "cloudfront_hosted_zone_id" {
  description = "CloudFront hosted zone ID."
  type        = string
}
