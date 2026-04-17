# =============================================================================
# outputs.tf - All Output Values
# =============================================================================

# ── API Gateway ───────────────────────────────────────────────────────────────
output "api_base_url" {
  description = "API Gateway base URL"
  value       = aws_apigatewayv2_api.main_api.api_endpoint
}

output "product_endpoint" {
  description = "Product Service URL"
  value       = "${aws_apigatewayv2_api.main_api.api_endpoint}/products"
}

output "cart_endpoint" {
  description = "Cart Service URL"
  value       = "${aws_apigatewayv2_api.main_api.api_endpoint}/cart"
}

output "order_endpoint" {
  description = "Order Service URL"
  value       = "${aws_apigatewayv2_api.main_api.api_endpoint}/orders"
}

# ── Lambda ────────────────────────────────────────────────────────────────────
output "product_lambda_name" {
  value = aws_lambda_function.product_service.function_name
}

output "cart_lambda_name" {
  value = aws_lambda_function.cart_service.function_name
}

output "order_lambda_name" {
  value = aws_lambda_function.order_service.function_name
}

# ── DynamoDB ──────────────────────────────────────────────────────────────────
output "product_table_name" {
  value = aws_dynamodb_table.products.name
}

output "cart_table_name" {
  value = aws_dynamodb_table.cart.name
}

output "order_table_name" {
  value = aws_dynamodb_table.orders.name
}

# ── Frontend ──────────────────────────────────────────────────────────────────
output "s3_bucket_name" {
  description = "S3 bucket name for frontend"
  value       = aws_s3_bucket.frontend.bucket
}

output "s3_website_url" {
  description = "S3 static website URL"
  value       = "http://${aws_s3_bucket_website_configuration.frontend.website_endpoint}"
}

output "cloudfront_url" {
  description = "CloudFront URL — use this for production!"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "cloudfront_id" {
  description = "CloudFront Distribution ID (needed for cache invalidation)"
  value       = aws_cloudfront_distribution.frontend.id
}
output "payment_function_name" {
  value = aws_lambda_function.payment.function_name
}

output "payment_function_arn" {
  value = aws_lambda_function.payment.arn
}