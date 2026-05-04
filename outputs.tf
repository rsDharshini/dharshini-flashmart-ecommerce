# =============================================================================
# outputs.tf - All Output Values
# =============================================================================

output "api_base_url" {
  description = "API Gateway base URL"
  value       = aws_apigatewayv2_api.main_api.api_endpoint
}

output "api_v1_base_url" {
  description = "Versioned API base URL"
  value       = "${aws_apigatewayv2_api.main_api.api_endpoint}/v1"
}

output "product_endpoint" {
  description = "Product Service URL"
  value       = "${aws_apigatewayv2_api.main_api.api_endpoint}/v1/products"
}

output "cart_endpoint" {
  description = "Cart Service URL"
  value       = "${aws_apigatewayv2_api.main_api.api_endpoint}/v1/cart"
}

output "order_endpoint" {
  description = "Order Service URL"
  value       = "${aws_apigatewayv2_api.main_api.api_endpoint}/v1/orders"
}

output "auth_endpoint" {
  description = "Auth Service URL"
  value       = "${aws_apigatewayv2_api.main_api.api_endpoint}/v1/auth"
}

output "payment_endpoint" {
  description = "Payment Service URL"
  value       = "${aws_apigatewayv2_api.main_api.api_endpoint}/v1/payments"
}

output "address_endpoint" {
  description = "Address Service URL"
  value       = "${aws_apigatewayv2_api.main_api.api_endpoint}/v1/addresses"
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

output "payment_function_name" {
  value = aws_lambda_function.payment.function_name
}

output "payment_function_arn" {
  value = aws_lambda_function.payment.arn
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
  value = aws_s3_bucket.frontend.bucket
}

output "s3_website_url" {
  value = "http://${aws_s3_bucket_website_configuration.frontend.website_endpoint}"
}

output "cloudfront_url" {
  description = "CloudFront URL — use this for production!"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "cloudfront_id" {
  value = aws_cloudfront_distribution.frontend.id
}
