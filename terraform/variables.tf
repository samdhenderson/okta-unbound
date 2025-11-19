variable "okta_org_name" {
  description = "Okta organization name (e.g., 'dev-123456' from dev-123456.okta.com)"
  type        = string
}

variable "okta_base_url" {
  description = "Okta base URL (e.g., 'okta.com', 'oktapreview.com', 'okta-emea.com')"
  type        = string
  default     = "okta.com"
}

variable "okta_api_token" {
  description = "Okta API token with admin permissions"
  type        = string
  sensitive   = true
}
