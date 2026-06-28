variable "bucket_name" {
  description = "Full S3 bucket name."
  type        = string
}

variable "allowed_origins" {
  description = "CORS allowed origins for browser PUT uploads."
  type        = list(string)
}

variable "tags" {
  description = "Resource tags."
  type        = map(string)
  default     = {}
}
