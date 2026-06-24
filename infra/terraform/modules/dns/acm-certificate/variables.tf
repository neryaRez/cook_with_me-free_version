variable "enabled" {
  description = "Whether to create the ACM certificate."
  type        = bool
  default     = false
}

variable "domain_name" {
  description = "Domain name for the ACM certificate."
  type        = string
}

variable "zone_id" {
  description = "Route 53 hosted zone ID used for DNS validation."
  type        = string
}

variable "tags" {
  description = "Tags to apply to resources."
  type        = map(string)
  default     = {}
}
