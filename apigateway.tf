# =============================================================================
# apigateway.tf - Single HTTP API Gateway with v1 versioning
# =============================================================================

resource "aws_apigatewayv2_api" "main_api" {
  name          = "${var.environment}-${var.project_name}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins  = ["*"]
    allow_methods  = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers  = ["Content-Type", "Authorization"]
    expose_headers = ["*"]
    max_age        = 300
  }
}

resource "aws_apigatewayv2_stage" "main_stage" {
  api_id      = aws_apigatewayv2_api.main_api.id
  name        = "$default"
  auto_deploy = true
}

# =============================================================================
# INTEGRATIONS
# =============================================================================

resource "aws_apigatewayv2_integration" "auth" {
  api_id                 = aws_apigatewayv2_api.main_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.auth_service.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "product" {
  api_id                 = aws_apigatewayv2_api.main_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.product_service.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "cart" {
  api_id                 = aws_apigatewayv2_api.main_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.cart_service.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "order" {
  api_id                 = aws_apigatewayv2_api.main_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.order_service.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "payment" {
  api_id                 = aws_apigatewayv2_api.main_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.payment.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "address" {
  api_id                 = aws_apigatewayv2_api.main_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.address.invoke_arn
  payload_format_version = "2.0"
}

# ── NEW ───────────────────────────────────────────────────────────────────────
resource "aws_apigatewayv2_integration" "logs" {
  api_id                 = aws_apigatewayv2_api.main_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.logs_service.invoke_arn
  payload_format_version = "2.0"
}

# =============================================================================
# ROUTES - AUTH
# =============================================================================

resource "aws_apigatewayv2_route" "auth_root" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "ANY /v1/auth"
  target    = "integrations/${aws_apigatewayv2_integration.auth.id}"
}

resource "aws_apigatewayv2_route" "auth_root_options" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "OPTIONS /v1/auth"
  target    = "integrations/${aws_apigatewayv2_integration.auth.id}"
}

resource "aws_apigatewayv2_route" "auth" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "ANY /v1/auth/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.auth.id}"
}

resource "aws_apigatewayv2_route" "auth_options" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "OPTIONS /v1/auth/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.auth.id}"
}

# =============================================================================
# ROUTES - PRODUCT
# =============================================================================

resource "aws_apigatewayv2_route" "product_root" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "ANY /v1/products"
  target    = "integrations/${aws_apigatewayv2_integration.product.id}"
}

resource "aws_apigatewayv2_route" "product_root_options" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "OPTIONS /v1/products"
  target    = "integrations/${aws_apigatewayv2_integration.product.id}"
}

resource "aws_apigatewayv2_route" "product" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "ANY /v1/products/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.product.id}"
}

resource "aws_apigatewayv2_route" "product_options" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "OPTIONS /v1/products/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.product.id}"
}

# =============================================================================
# ROUTES - CART
# =============================================================================

resource "aws_apigatewayv2_route" "cart_root" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "ANY /v1/cart"
  target    = "integrations/${aws_apigatewayv2_integration.cart.id}"
}

resource "aws_apigatewayv2_route" "cart_root_options" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "OPTIONS /v1/cart"
  target    = "integrations/${aws_apigatewayv2_integration.cart.id}"
}

resource "aws_apigatewayv2_route" "cart" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "ANY /v1/cart/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.cart.id}"
}

resource "aws_apigatewayv2_route" "cart_options" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "OPTIONS /v1/cart/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.cart.id}"
}

# =============================================================================
# ROUTES - ORDERS
# =============================================================================

resource "aws_apigatewayv2_route" "orders_root" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "ANY /v1/orders"
  target    = "integrations/${aws_apigatewayv2_integration.order.id}"
}

resource "aws_apigatewayv2_route" "orders_root_options" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "OPTIONS /v1/orders"
  target    = "integrations/${aws_apigatewayv2_integration.order.id}"
}

resource "aws_apigatewayv2_route" "orders" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "ANY /v1/orders/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.order.id}"
}

resource "aws_apigatewayv2_route" "orders_options" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "OPTIONS /v1/orders/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.order.id}"
}

# =============================================================================
# ROUTES - PAYMENT
# =============================================================================

resource "aws_apigatewayv2_route" "payment_initiate" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "POST /v1/payments/initiate"
  target    = "integrations/${aws_apigatewayv2_integration.payment.id}"
}

resource "aws_apigatewayv2_route" "payment_initiate_options" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "OPTIONS /v1/payments/initiate"
  target    = "integrations/${aws_apigatewayv2_integration.payment.id}"
}

resource "aws_apigatewayv2_route" "payment_verify" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "POST /v1/payments/verify"
  target    = "integrations/${aws_apigatewayv2_integration.payment.id}"
}

resource "aws_apigatewayv2_route" "payment_verify_options" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "OPTIONS /v1/payments/verify"
  target    = "integrations/${aws_apigatewayv2_integration.payment.id}"
}

# =============================================================================
# ROUTES - ADDRESS
# =============================================================================

resource "aws_apigatewayv2_route" "address_get" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "GET /v1/addresses/{user_id}"
  target    = "integrations/${aws_apigatewayv2_integration.address.id}"
}

resource "aws_apigatewayv2_route" "address_add" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "POST /v1/addresses/{user_id}"
  target    = "integrations/${aws_apigatewayv2_integration.address.id}"
}

resource "aws_apigatewayv2_route" "address_options" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "OPTIONS /v1/addresses/{user_id}"
  target    = "integrations/${aws_apigatewayv2_integration.address.id}"
}

# =============================================================================
# ROUTES - LOGS (NEW)
# =============================================================================

resource "aws_apigatewayv2_route" "logs_root" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "ANY /v1/logs"
  target    = "integrations/${aws_apigatewayv2_integration.logs.id}"
}

resource "aws_apigatewayv2_route" "logs_proxy" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "ANY /v1/logs/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.logs.id}"
}

resource "aws_apigatewayv2_route" "logs_options" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "OPTIONS /v1/logs"
  target    = "integrations/${aws_apigatewayv2_integration.logs.id}"
}

# =============================================================================
# LAMBDA PERMISSIONS
# =============================================================================

resource "aws_lambda_permission" "auth" {
  statement_id  = "AllowAuth"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_service.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "product" {
  statement_id  = "AllowProduct"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.product_service.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "cart" {
  statement_id  = "AllowCart"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cart_service.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "order" {
  statement_id  = "AllowOrder"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.order_service.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "payment" {
  statement_id  = "AllowPayment"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.payment.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "address" {
  statement_id  = "AllowAddress"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.address.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main_api.execution_arn}/*/*"
}

# ── NEW ───────────────────────────────────────────────────────────────────────
resource "aws_lambda_permission" "logs" {
  statement_id  = "AllowLogs"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.logs_service.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main_api.execution_arn}/*/*"
}
