variable "user_pool_name" {
  description = "Cognito User Pool name."
  type        = string
}

variable "app_client_name" {
  description = "Cognito User Pool App Client name."
  type        = string
}

variable "domain_prefix" {
  description = "Prefix for the Cognito Hosted UI domain."
  type        = string
}

variable "callback_urls" {
  description = "Allowed OAuth callback URLs."
  type        = list(string)
}

variable "logout_urls" {
  description = "Allowed OAuth logout URLs."
  type        = list(string)
}

variable "aws_region" {
  description = "AWS region where Cognito is deployed."
  type        = string
}

variable "password_minimum_length" {
  description = "Minimum password length."
  type        = number
  default     = 8
}

variable "tags" {
  description = "Tags to apply to Cognito resources."
  type        = map(string)
  default     = {}
}
variable "ui_custom_css" {
  description = "Custom CSS for Cognito Hosted UI."
  type        = string
  default     = ""
}
