# =============================================================================
# dynamodb.tf - All DynamoDB Tables
# =============================================================================

# ── Products Table ────────────────────────────────────────────────────────────
resource "aws_dynamodb_table" "products" {
  name         = var.product_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Name        = var.product_table_name
    Project     = var.project_name
    Environment = var.environment
  }
}

# ── Cart Table ────────────────────────────────────────────────────────────────
resource "aws_dynamodb_table" "cart" {
  name         = var.cart_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"

  attribute {
    name = "user_id"
    type = "S"
  }

  tags = {
    Name        = var.cart_table_name
    Project     = var.project_name
    Environment = var.environment
  }
}

# ── Orders Table ──────────────────────────────────────────────────────────────
resource "aws_dynamodb_table" "orders" {
  name         = var.order_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "order_id"

  attribute {
    name = "order_id"
    type = "S"
  }

  tags = {
    Name        = var.order_table_name
    Project     = var.project_name
    Environment = var.environment
  }
}


resource "aws_dynamodb_table" "auth_table" {
  name         = var.auth_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
    Service     = "auth"
  }
}

# --- Payments Table (NEW) ---
resource "aws_dynamodb_table" "payments" {
  name         = "${var.environment}-${var.project_name}-payments"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "payment_id"

  attribute {
    name = "payment_id"
    type = "S"
  }

  attribute {
    name = "order_id"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  global_secondary_index {
    name            = "order_id-index"
    hash_key        = "order_id"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "user_id-index"
    hash_key        = "user_id"
    projection_type = "ALL"
  }

  tags = {
    Name        = "${var.environment}-${var.project_name}-payments"
    Environment = var.environment
    Project     = var.project_name
  }
}