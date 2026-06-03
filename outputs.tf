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
  value = "${aws_apigatewayv2_api.main_api.api_endpoint}/v1/products"
}

output "cart_endpoint" {
  value = "${aws_apigatewayv2_api.main_api.api_endpoint}/v1/cart"
}

output "order_endpoint" {
  value = "${aws_apigatewayv2_api.main_api.api_endpoint}/v1/orders"
}

output "auth_endpoint" {
  value = "${aws_apigatewayv2_api.main_api.api_endpoint}/v1/auth"
}

output "payment_endpoint" {
  value = "${aws_apigatewayv2_api.main_api.api_endpoint}/v1/payments"
}

output "address_endpoint" {
  value = "${aws_apigatewayv2_api.main_api.api_endpoint}/v1/addresses"
}

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

output "product_table_name" {
  value = aws_dynamodb_table.products.name
}

output "cart_table_name" {
  value = aws_dynamodb_table.cart.name
}

output "order_table_name" {
  value = aws_dynamodb_table.orders.name
}

output "s3_bucket_name" {
  value = aws_s3_bucket.frontend.bucket
}

output "cloudfront_url" {
  description = "CloudFront URL — use this for production!"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "cloudfront_id" {
  value = aws_cloudfront_distribution.frontend.id
}