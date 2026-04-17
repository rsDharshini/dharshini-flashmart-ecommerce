# =============================================================================
# variables.tf - All Input Variables
# =============================================================================

# ── General ───────────────────────────────────────────────────────────────────
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-southeast-1"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "flashmart"
}

variable "environment" {
  description = "Environment prefix"
  type        = string
  default     = "dev"
}

# ── DynamoDB ──────────────────────────────────────────────────────────────────
variable "product_table_name" {
  type    = string
  default = "dev-flashmart-products"
}

variable "cart_table_name" {
  type    = string
  default = "dev-flashmart-cart"
}

variable "order_table_name" {
  type    = string
  default = "dev-flashmart-orders"
}

# ── Lambda ────────────────────────────────────────────────────────────────────
variable "lambda_runtime" {
  type    = string
  default = "python3.12"
}

variable "lambda_timeout" {
  type    = number
  default = 30
}

variable "lambda_memory" {
  type    = number
  default = 256
}

variable "product_function_name" {
  type    = string
  default = "dev-flashmart-product-service"
}

variable "cart_function_name" {
  type    = string
  default = "dev-flashmart-cart-service"
}

variable "order_function_name" {
  type    = string
  default = "dev-flashmart-order-service"
}

# ── Service URLs ──────────────────────────────────────────────────────────────
variable "product_service_url" {
  type    = string
  default = "PLACEHOLDER"
}

variable "cart_service_url" {
  type    = string
  default = "PLACEHOLDER"
}

variable "order_service_url" {
  type    = string
  default = "PLACEHOLDER"
}

# ── Frontend S3 ───────────────────────────────────────────────────────────────
variable "frontend_bucket_name" {
  description = "S3 bucket name for React frontend"
  type        = string
  default     = "dev-flashmart-frontend"
}

# ── Auth Service ─────────────────────────────────────────────
variable "auth_table_name" {
  type    = string
  default = "dev-flashmart_users"
}

variable "auth_function_name" {
  type    = string
  default = "dev-flashmart-auth-service"
}

variable "jwt_secret" {
  type      = string
  sensitive = true
}

# ── Payments Table ────────────────────────────────────────────
variable "payment_table_name" {
  type    = string
  default = "dev-flashmart-payments"
}

variable "payment_function_name" {
  type    = string
  default = "dev-flashmart-payment-service"
}

# ── Razorpay ──────────────────────────────────────────────────
variable "razorpay_key_id" {
  type      = string
  sensitive = true
}

variable "razorpay_key_secret" {
  type      = string
  sensitive = true
}

variable "address_function_name" {
  type    = string
  default = "dev-flashmart-address-service"
}