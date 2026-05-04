# =============================================================================
# lambda.tf - All Lambda Functions
# =============================================================================

data "archive_file" "product_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_code/product_service"
  output_path = "${path.module}/lambda_code/zips/product_service.zip"
}

data "archive_file" "cart_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_code/cart_service"
  output_path = "${path.module}/lambda_code/zips/cart_service.zip"
}

data "archive_file" "order_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_code/order_service"
  output_path = "${path.module}/lambda_code/zips/order_service.zip"
}

data "archive_file" "auth_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_code/auth_service"
  output_path = "${path.module}/lambda_code/zips/auth_service.zip"
}

data "archive_file" "payment" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_code/payment_service"
  output_path = "${path.module}/lambda_code/zips/payment_service.zip"
}

data "archive_file" "address" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_code/address_service"
  output_path = "${path.module}/lambda_code/zips/address_service.zip"
}

# ── NEW: Logs Service ─────────────────────────────────────────────────────────
data "archive_file" "logs" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_code/logs_service"
  output_path = "${path.module}/lambda_code/zips/logs_service.zip"
}

# =============================================================================
# LAMBDA FUNCTIONS
# =============================================================================

resource "aws_lambda_function" "product_service" {
  function_name    = var.product_function_name
  role             = aws_iam_role.lambda_role.arn
  runtime          = var.lambda_runtime
  handler          = "lambda_function.lambda_handler"
  filename         = data.archive_file.product_zip.output_path
  source_code_hash = data.archive_file.product_zip.output_base64sha256
  timeout          = var.lambda_timeout
  memory_size      = var.lambda_memory

  environment {
    variables = {
      DYNAMODB_TABLE = var.product_table_name
      ENVIRONMENT    = var.environment
    }
  }

  tags = { Project = var.project_name, Environment = var.environment, Service = "product" }
}

resource "aws_lambda_function" "cart_service" {
  function_name    = var.cart_function_name
  role             = aws_iam_role.lambda_role.arn
  runtime          = var.lambda_runtime
  handler          = "lambda_function.lambda_handler"
  filename         = data.archive_file.cart_zip.output_path
  source_code_hash = data.archive_file.cart_zip.output_base64sha256
  timeout          = var.lambda_timeout
  memory_size      = var.lambda_memory

  environment {
    variables = {
      DYNAMODB_TABLE      = var.cart_table_name
      ENVIRONMENT         = var.environment
      PRODUCT_SERVICE_URL = var.product_service_url
      JWT_SECRET          = var.jwt_secret
    }
  }

  tags = { Project = var.project_name, Environment = var.environment, Service = "cart" }
}

resource "aws_lambda_function" "order_service" {
  function_name    = var.order_function_name
  role             = aws_iam_role.lambda_role.arn
  runtime          = var.lambda_runtime
  handler          = "lambda_function.lambda_handler"
  filename         = data.archive_file.order_zip.output_path
  source_code_hash = data.archive_file.order_zip.output_base64sha256
  timeout          = var.lambda_timeout
  memory_size      = var.lambda_memory

  environment {
    variables = {
      DYNAMODB_TABLE      = var.order_table_name
      ENVIRONMENT         = var.environment
      CART_SERVICE_URL    = var.cart_service_url
      PRODUCT_SERVICE_URL = var.product_service_url
      JWT_SECRET          = var.jwt_secret
    }
  }

  tags = { Project = var.project_name, Environment = var.environment, Service = "order" }
}

resource "aws_lambda_function" "auth_service" {
  function_name    = var.auth_function_name
  role             = aws_iam_role.lambda_role.arn
  runtime          = var.lambda_runtime
  handler          = "lambda_function.lambda_handler"
  filename         = data.archive_file.auth_zip.output_path
  source_code_hash = data.archive_file.auth_zip.output_base64sha256
  timeout          = var.lambda_timeout
  memory_size      = var.lambda_memory

  environment {
    variables = {
      DYNAMODB_TABLE = var.auth_table_name
      ENVIRONMENT    = var.environment
      JWT_SECRET     = "mySuperSecretKey123!"
    }
  }

  tags = { Project = var.project_name, Environment = var.environment, Service = "auth" }
}

resource "aws_lambda_function" "payment" {
  filename         = data.archive_file.payment.output_path
  function_name    = var.payment_function_name
  role             = aws_iam_role.lambda_role.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = var.lambda_runtime
  timeout          = var.lambda_timeout
  memory_size      = var.lambda_memory
  source_code_hash = data.archive_file.payment.output_base64sha256

  environment {
    variables = {
      JWT_SECRET          = var.jwt_secret
      RAZORPAY_KEY_ID     = var.razorpay_key_id
      RAZORPAY_KEY_SECRET = var.razorpay_key_secret
      PAYMENT_TABLE_NAME  = aws_dynamodb_table.payments.name
      ORDER_SERVICE_URL   = var.order_service_url
    }
  }

  tags = { Name = var.payment_function_name, Environment = var.environment, Project = var.project_name }
}

resource "aws_lambda_function" "address" {
  filename         = data.archive_file.address.output_path
  function_name    = var.address_function_name
  role             = aws_iam_role.lambda_role.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = var.lambda_runtime
  timeout          = var.lambda_timeout
  memory_size      = var.lambda_memory
  source_code_hash = data.archive_file.address.output_base64sha256

  environment {
    variables = {
      JWT_SECRET       = var.jwt_secret
      USERS_TABLE_NAME = var.auth_table_name
    }
  }

  tags = { Name = var.address_function_name, Environment = var.environment, Project = var.project_name }
}

# ── NEW: Logs Service Lambda ──────────────────────────────────────────────────
resource "aws_lambda_function" "logs_service" {
  filename         = data.archive_file.logs.output_path
  function_name    = "${var.environment}-${var.project_name}-logs-service"
  role             = aws_iam_role.lambda_role.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = var.lambda_runtime
  timeout          = var.lambda_timeout
  memory_size      = var.lambda_memory
  source_code_hash = data.archive_file.logs.output_base64sha256

  environment {
    variables = {
      LOGS_TABLE_NAME = aws_dynamodb_table.logs.name
      ENVIRONMENT     = var.environment
    }
  }

  tags = { Project = var.project_name, Environment = var.environment, Service = "logs" }
}
