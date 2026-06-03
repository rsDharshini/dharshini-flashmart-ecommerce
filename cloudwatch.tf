# =============================================================================
# cloudwatch.tf - FlashMart Observability & Monitoring
# =============================================================================

locals {
  tags = { Project = var.project_name, Environment = var.environment }

  lambda_functions = {
    auth    = var.auth_function_name
    product = var.product_function_name
    cart    = var.cart_function_name
    order   = var.order_function_name
    payment = var.payment_function_name
    address = var.address_function_name
  }

  dynamodb_tables = {
    products = var.product_table_name
    cart     = var.cart_table_name
    orders   = var.order_table_name
    auth     = var.auth_table_name
    payments = "${var.environment}-${var.project_name}-payments"
    logs     = "${var.environment}-${var.project_name}-logs"
  }

  s3_buckets = {
    frontend       = var.frontend_bucket_name
    product_images = "flashmart-product-images"
  }
}

# =============================================================================
# SECTION 1 — LOG GROUPS
# =============================================================================

resource "aws_cloudwatch_log_group" "services" {
  for_each          = local.lambda_functions
  name              = "/aws/lambda/${each.value}"
  retention_in_days = 14
  tags              = merge(local.tags, { Service = each.key })
}

resource "aws_cloudwatch_log_group" "logs_service" {
  name              = "/aws/lambda/${var.environment}-${var.project_name}-logs-service"
  retention_in_days = 14
  tags              = merge(local.tags, { Service = "logs" })
}

# =============================================================================
# SECTION 2 — METRIC FILTERS
# =============================================================================

resource "aws_cloudwatch_log_metric_filter" "login_success" {
  name           = "${var.environment}-${var.project_name}-login-success"
  log_group_name = aws_cloudwatch_log_group.services["auth"].name
  pattern        = "{ $.event = \"login_success\" }"
  metric_transformation {
    name          = "LoginSuccess"
    namespace     = "FlashMart/Auth"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "login_failed" {
  name           = "${var.environment}-${var.project_name}-login-failed"
  log_group_name = aws_cloudwatch_log_group.services["auth"].name
  pattern        = "{ $.event = \"login_failed\" }"
  metric_transformation {
    name          = "LoginFailed"
    namespace     = "FlashMart/Auth"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "auth_errors" {
  name           = "${var.environment}-${var.project_name}-auth-errors"
  log_group_name = aws_cloudwatch_log_group.services["auth"].name
  pattern        = "{ $.event = \"unhandled_exception\" }"
  metric_transformation {
    name          = "Errors"
    namespace     = "FlashMart/Auth"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "payment_success" {
  name           = "${var.environment}-${var.project_name}-payment-success"
  log_group_name = aws_cloudwatch_log_group.services["payment"].name
  pattern        = "{ $.event = \"payment_verified\" }"
  metric_transformation {
    name          = "PaymentSuccess"
    namespace     = "FlashMart/Payments"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "payment_failed" {
  name           = "${var.environment}-${var.project_name}-payment-failed"
  log_group_name = aws_cloudwatch_log_group.services["payment"].name
  pattern        = "{ $.event = \"payment_failed\" }"
  metric_transformation {
    name          = "PaymentFailed"
    namespace     = "FlashMart/Payments"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "payment_errors" {
  name           = "${var.environment}-${var.project_name}-payment-errors"
  log_group_name = aws_cloudwatch_log_group.services["payment"].name
  pattern        = "{ $.event = \"unhandled_exception\" }"
  metric_transformation {
    name          = "Errors"
    namespace     = "FlashMart/Payments"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "order_placed" {
  name           = "${var.environment}-${var.project_name}-order-placed"
  log_group_name = aws_cloudwatch_log_group.services["order"].name
  pattern        = "{ $.event = \"order_placed\" }"
  metric_transformation {
    name          = "OrderPlaced"
    namespace     = "FlashMart/Orders"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "order_errors" {
  name           = "${var.environment}-${var.project_name}-order-errors"
  log_group_name = aws_cloudwatch_log_group.services["order"].name
  pattern        = "{ $.event = \"unhandled_exception\" }"
  metric_transformation {
    name          = "Errors"
    namespace     = "FlashMart/Orders"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "cart_errors" {
  name           = "${var.environment}-${var.project_name}-cart-errors"
  log_group_name = aws_cloudwatch_log_group.services["cart"].name
  pattern        = "{ $.event = \"unhandled_exception\" }"
  metric_transformation {
    name          = "Errors"
    namespace     = "FlashMart/Cart"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "product_errors" {
  name           = "${var.environment}-${var.project_name}-product-errors"
  log_group_name = aws_cloudwatch_log_group.services["product"].name
  pattern        = "{ $.event = \"unhandled_exception\" }"
  metric_transformation {
    name          = "Errors"
    namespace     = "FlashMart/Products"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "address_errors" {
  name           = "${var.environment}-${var.project_name}-address-errors"
  log_group_name = aws_cloudwatch_log_group.services["address"].name
  pattern        = "{ $.event = \"unhandled_exception\" }"
  metric_transformation {
    name          = "Errors"
    namespace     = "FlashMart/Address"
    value         = "1"
    default_value = "0"
  }
}

# =============================================================================
# SECTION 3 — LAMBDA ALARMS
# =============================================================================

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each            = local.lambda_functions
  alarm_name          = "${var.environment}-${var.project_name}-${each.key}-lambda-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 3
  alarm_description   = "${each.key} Lambda errors > 3 in 1 minute"
  treat_missing_data  = "notBreaching"
  dimensions          = { FunctionName = each.value }
  tags                = local.tags
}

resource "aws_cloudwatch_metric_alarm" "payment_failures_high" {
  alarm_name          = "${var.environment}-${var.project_name}-payment-failures-high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "PaymentFailed"
  namespace           = "FlashMart/Payments"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "5+ payment failures in 5 minutes"
  treat_missing_data  = "notBreaching"
  tags                = local.tags
}

resource "aws_cloudwatch_metric_alarm" "payment_lambda_duration" {
  alarm_name          = "${var.environment}-${var.project_name}-payment-lambda-duration"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Average"
  threshold           = 10000
  alarm_description   = "Payment Lambda avg duration > 10s"
  treat_missing_data  = "notBreaching"
  dimensions          = { FunctionName = var.payment_function_name }
  tags                = local.tags
}

resource "aws_cloudwatch_metric_alarm" "login_failures_high" {
  alarm_name          = "${var.environment}-${var.project_name}-login-failures-high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "LoginFailed"
  namespace           = "FlashMart/Auth"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "10+ login failures in 5 minutes — possible brute force"
  treat_missing_data  = "notBreaching"
  tags                = local.tags
}

# =============================================================================
# SECTION 4 — DYNAMODB ALARMS
# =============================================================================

resource "aws_cloudwatch_metric_alarm" "dynamodb_read_throttles" {
  for_each            = local.dynamodb_tables
  alarm_name          = "${var.environment}-${var.project_name}-ddb-${each.key}-read-throttles"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ReadThrottleEvents"
  namespace           = "AWS/DynamoDB"
  period              = 60
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "DynamoDB ${each.key} read throttles >= 5"
  treat_missing_data  = "notBreaching"
  dimensions          = { TableName = each.value }
  tags                = local.tags
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_write_throttles" {
  for_each            = local.dynamodb_tables
  alarm_name          = "${var.environment}-${var.project_name}-ddb-${each.key}-write-throttles"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "WriteThrottleEvents"
  namespace           = "AWS/DynamoDB"
  period              = 60
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "DynamoDB ${each.key} write throttles >= 5"
  treat_missing_data  = "notBreaching"
  dimensions          = { TableName = each.value }
  tags                = local.tags
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_system_errors" {
  for_each            = local.dynamodb_tables
  alarm_name          = "${var.environment}-${var.project_name}-ddb-${each.key}-system-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "SystemErrors"
  namespace           = "AWS/DynamoDB"
  period              = 60
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "DynamoDB ${each.key} system errors > 0"
  treat_missing_data  = "notBreaching"
  dimensions          = { TableName = each.value }
  tags                = local.tags
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_user_errors" {
  for_each            = local.dynamodb_tables
  alarm_name          = "${var.environment}-${var.project_name}-ddb-${each.key}-user-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "UserErrors"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = 20
  alarm_description   = "DynamoDB ${each.key} user errors >= 20"
  treat_missing_data  = "notBreaching"
  dimensions          = { TableName = each.value }
  tags                = local.tags
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_get_latency" {
  for_each            = local.dynamodb_tables
  alarm_name          = "${var.environment}-${var.project_name}-ddb-${each.key}-get-latency"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 3
  metric_name         = "SuccessfulRequestLatency"
  namespace           = "AWS/DynamoDB"
  period              = 60
  extended_statistic  = "p99"
  threshold           = 50
  alarm_description   = "DynamoDB ${each.key} GetItem p99 latency >= 50ms"
  treat_missing_data  = "notBreaching"
  dimensions          = { TableName = each.value, Operation = "GetItem" }
  tags                = local.tags
}

# =============================================================================
# SECTION 5 — S3 ALARMS
# =============================================================================

resource "aws_cloudwatch_metric_alarm" "s3_4xx_errors" {
  for_each            = local.s3_buckets
  alarm_name          = "${var.environment}-${var.project_name}-s3-${each.key}-4xx"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "4xxErrors"
  namespace           = "AWS/S3"
  period              = 300
  statistic           = "Sum"
  threshold           = 50
  alarm_description   = "S3 ${each.key} 4xx errors >= 50"
  treat_missing_data  = "notBreaching"
  dimensions          = { BucketName = each.value, FilterId = "EntireBucket" }
  tags                = local.tags
}

resource "aws_cloudwatch_metric_alarm" "s3_5xx_errors" {
  for_each            = local.s3_buckets
  alarm_name          = "${var.environment}-${var.project_name}-s3-${each.key}-5xx"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "5xxErrors"
  namespace           = "AWS/S3"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "S3 ${each.key} 5xx errors >= 10"
  treat_missing_data  = "notBreaching"
  dimensions          = { BucketName = each.value, FilterId = "EntireBucket" }
  tags                = local.tags
}

# =============================================================================
# SECTION 6 — CLOUDFRONT ALARMS
# =============================================================================

resource "aws_cloudwatch_metric_alarm" "cf_5xx_rate" {
  alarm_name          = "${var.environment}-${var.project_name}-cf-5xx-rate"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "5xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = 300
  statistic           = "Average"
  threshold           = 5
  alarm_description   = "CloudFront 5xx error rate >= 5%"
  treat_missing_data  = "notBreaching"
  dimensions          = { DistributionId = aws_cloudfront_distribution.frontend.id, Region = "Global" }
  tags                = local.tags
}

resource "aws_cloudwatch_metric_alarm" "cf_4xx_rate" {
  alarm_name          = "${var.environment}-${var.project_name}-cf-4xx-rate"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "4xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = 300
  statistic           = "Average"
  threshold           = 10
  alarm_description   = "CloudFront 4xx error rate >= 10%"
  treat_missing_data  = "notBreaching"
  dimensions          = { DistributionId = aws_cloudfront_distribution.frontend.id, Region = "Global" }
  tags                = local.tags
}

resource "aws_cloudwatch_metric_alarm" "cf_cache_hit_low" {
  alarm_name          = "${var.environment}-${var.project_name}-cf-cache-hit-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CacheHitRate"
  namespace           = "AWS/CloudFront"
  period              = 300
  statistic           = "Average"
  threshold           = 60
  alarm_description   = "CloudFront cache hit rate < 60%"
  treat_missing_data  = "notBreaching"
  dimensions          = { DistributionId = aws_cloudfront_distribution.frontend.id, Region = "Global" }
  tags                = local.tags
}

resource "aws_cloudwatch_metric_alarm" "cf_origin_latency" {
  alarm_name          = "${var.environment}-${var.project_name}-cf-origin-latency"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "OriginLatency"
  namespace           = "AWS/CloudFront"
  period              = 300
  extended_statistic  = "p95"
  threshold           = 3000
  alarm_description   = "CloudFront p95 origin latency >= 3s"
  treat_missing_data  = "notBreaching"
  dimensions          = { DistributionId = aws_cloudfront_distribution.frontend.id, Region = "Global" }
  tags                = local.tags
}

# =============================================================================
# SECTION 7 — S3 METRIC CONFIGURATIONS (enables request-level metrics)
# =============================================================================

resource "aws_s3_bucket_metric" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  name   = "EntireBucket"
}

resource "aws_s3_bucket_metric" "product_images" {
  bucket = aws_s3_bucket.product_images.id
  name   = "EntireBucket"
}

# =============================================================================
# SECTION 8 — DASHBOARD
# =============================================================================

resource "aws_cloudwatch_dashboard" "flashmart" {
  dashboard_name = "${var.environment}-${var.project_name}-dashboard"

  dashboard_body = jsonencode({
    widgets = [

      # Row 1: Lambda health
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "Lambda errors — all services"
          view    = "timeSeries"
          region  = "ap-southeast-1"
          stat    = "Sum"
          period  = 60
          metrics = [
            ["AWS/Lambda", "Errors", "FunctionName", var.auth_function_name,    { label = "auth" }],
            ["AWS/Lambda", "Errors", "FunctionName", var.product_function_name, { label = "product" }],
            ["AWS/Lambda", "Errors", "FunctionName", var.cart_function_name,    { label = "cart" }],
            ["AWS/Lambda", "Errors", "FunctionName", var.order_function_name,   { label = "order" }],
            ["AWS/Lambda", "Errors", "FunctionName", var.payment_function_name, { label = "payment" }],
            ["AWS/Lambda", "Errors", "FunctionName", var.address_function_name, { label = "address" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "Lambda duration (ms) — all services"
          view    = "timeSeries"
          region  = "ap-southeast-1"
          stat    = "Average"
          period  = 60
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", var.auth_function_name,    { label = "auth" }],
            ["AWS/Lambda", "Duration", "FunctionName", var.product_function_name, { label = "product" }],
            ["AWS/Lambda", "Duration", "FunctionName", var.cart_function_name,    { label = "cart" }],
            ["AWS/Lambda", "Duration", "FunctionName", var.order_function_name,   { label = "order" }],
            ["AWS/Lambda", "Duration", "FunctionName", var.payment_function_name, { label = "payment" }],
            ["AWS/Lambda", "Duration", "FunctionName", var.address_function_name, { label = "address" }]
          ]
        }
      },

      # Row 2: Invocations & throttles
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title   = "Lambda invocations"
          view    = "timeSeries"
          region  = "ap-southeast-1"
          stat    = "Sum"
          period  = 60
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", var.auth_function_name,    { label = "auth" }],
            ["AWS/Lambda", "Invocations", "FunctionName", var.product_function_name, { label = "product" }],
            ["AWS/Lambda", "Invocations", "FunctionName", var.cart_function_name,    { label = "cart" }],
            ["AWS/Lambda", "Invocations", "FunctionName", var.order_function_name,   { label = "order" }],
            ["AWS/Lambda", "Invocations", "FunctionName", var.payment_function_name, { label = "payment" }],
            ["AWS/Lambda", "Invocations", "FunctionName", var.address_function_name, { label = "address" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title   = "Lambda throttles"
          view    = "timeSeries"
          region  = "ap-southeast-1"
          stat    = "Sum"
          period  = 60
          metrics = [
            ["AWS/Lambda", "Throttles", "FunctionName", var.auth_function_name,    { label = "auth" }],
            ["AWS/Lambda", "Throttles", "FunctionName", var.payment_function_name, { label = "payment" }],
            ["AWS/Lambda", "Throttles", "FunctionName", var.order_function_name,   { label = "order" }]
          ]
        }
      },

      # Row 3: Business metrics
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 8
        height = 6
        properties = {
          title   = "Payments — success vs failed"
          view    = "timeSeries"
          region  = "ap-southeast-1"
          stat    = "Sum"
          period  = 300
          metrics = [
            ["FlashMart/Payments", "PaymentSuccess", { label = "success", color = "#2ca02c" }],
            ["FlashMart/Payments", "PaymentFailed",  { label = "failed",  color = "#d62728" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 12
        width  = 8
        height = 6
        properties = {
          title   = "Auth — login success vs failed"
          view    = "timeSeries"
          region  = "ap-southeast-1"
          stat    = "Sum"
          period  = 300
          metrics = [
            ["FlashMart/Auth", "LoginSuccess", { label = "success", color = "#2ca02c" }],
            ["FlashMart/Auth", "LoginFailed",  { label = "failed",  color = "#d62728" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 12
        width  = 8
        height = 6
        properties = {
          title   = "Orders placed"
          view    = "timeSeries"
          region  = "ap-southeast-1"
          stat    = "Sum"
          period  = 300
          metrics = [
            ["FlashMart/Orders", "OrderPlaced", { label = "orders", color = "#1f77b4" }]
          ]
        }
      },

      # Row 4: API Gateway
      {
        type   = "metric"
        x      = 0
        y      = 18
        width  = 8
        height = 6
        properties = {
          title   = "Total API Requests"
          view    = "timeSeries"
          region  = "ap-southeast-1"
          stat    = "Sum"
          period  = 300
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiName", "dev-ecommerce-api", "Stage", "dev"]
          ]
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 18
        width  = 8
        height = 6
        properties = {
          title   = "API Gateway Latency"
          view    = "timeSeries"
          region  = "ap-southeast-1"
          stat    = "Average"
          period  = 300
          metrics = [
            ["AWS/ApiGateway", "Latency", "ApiName", "dev-ecommerce-api", "Stage", "dev", { label = "Avg Latency" }],
            [".", "Latency", ".", ".", ".", ".", { stat = "p95", label = "p95 Latency" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 18
        width  = 8
        height = 6
        properties = {
          title   = "API Gateway HTTP Errors"
          view    = "timeSeries"
          region  = "ap-southeast-1"
          stat    = "Sum"
          period  = 300
          metrics = [
            ["AWS/ApiGateway", "4XXError", "ApiName", "dev-ecommerce-api", "Stage", "dev", { label = "4XX Errors" }],
            [".", "5XXError", ".", ".", ".", ".", { label = "5XX Errors" }]
          ]
        }
      },

      # Row 5: CloudFront
      {
        type   = "metric"
        x      = 0
        y      = 24
        width  = 8
        height = 6
        properties = {
          title   = "CloudFront — requests & error rates"
          view    = "timeSeries"
          region  = "us-east-1"
          stat    = "Sum"
          period  = 300
          metrics = [
            ["AWS/CloudFront", "Requests",     "DistributionId", aws_cloudfront_distribution.frontend.id, "Region", "Global", { label = "Requests" }],
            ["AWS/CloudFront", "4xxErrorRate", "DistributionId", aws_cloudfront_distribution.frontend.id, "Region", "Global", { stat = "Average", label = "4xx %" }],
            ["AWS/CloudFront", "5xxErrorRate", "DistributionId", aws_cloudfront_distribution.frontend.id, "Region", "Global", { stat = "Average", label = "5xx %" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 24
        width  = 8
        height = 6
        properties = {
          title   = "CloudFront — cache hit rate"
          view    = "timeSeries"
          region  = "us-east-1"
          stat    = "Average"
          period  = 300
          metrics = [
            ["AWS/CloudFront", "CacheHitRate", "DistributionId", aws_cloudfront_distribution.frontend.id, "Region", "Global", { label = "Cache Hit %" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 24
        width  = 8
        height = 6
        properties = {
          title   = "CloudFront — origin latency (ms)"
          view    = "timeSeries"
          region  = "us-east-1"
          stat    = "Average"
          period  = 300
          metrics = [
            ["AWS/CloudFront", "OriginLatency", "DistributionId", aws_cloudfront_distribution.frontend.id, "Region", "Global", { label = "Avg" }],
            ["AWS/CloudFront", "OriginLatency", "DistributionId", aws_cloudfront_distribution.frontend.id, "Region", "Global", { stat = "p95", label = "p95" }]
          ]
        }
      },

      # Row 6: DynamoDB
      {
        type   = "metric"
        x      = 0
        y      = 30
        width  = 8
        height = 6
        properties = {
          title   = "DynamoDB — consumed capacity"
          view    = "timeSeries"
          region  = "ap-southeast-1"
          stat    = "Sum"
          period  = 60
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits",  "TableName", var.product_table_name, { label = "products RCU" }],
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits",  "TableName", var.order_table_name,   { label = "orders RCU" }],
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", var.product_table_name, { label = "products WCU" }],
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", var.order_table_name,   { label = "orders WCU" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 30
        width  = 8
        height = 6
        properties = {
          title   = "DynamoDB — throttle events"
          view    = "timeSeries"
          region  = "ap-southeast-1"
          stat    = "Sum"
          period  = 60
          metrics = [
            ["AWS/DynamoDB", "ReadThrottleEvents",  "TableName", var.product_table_name,                                { label = "products read" }],
            ["AWS/DynamoDB", "WriteThrottleEvents", "TableName", var.product_table_name,                                { label = "products write" }],
            ["AWS/DynamoDB", "ReadThrottleEvents",  "TableName", var.order_table_name,                                  { label = "orders read" }],
            ["AWS/DynamoDB", "WriteThrottleEvents", "TableName", "${var.environment}-${var.project_name}-payments",     { label = "payments write" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 30
        width  = 8
        height = 6
        properties = {
          title   = "DynamoDB — request latency p99 (ms)"
          view    = "timeSeries"
          region  = "ap-southeast-1"
          stat    = "p99"
          period  = 60
          metrics = [
            ["AWS/DynamoDB", "SuccessfulRequestLatency", "TableName", var.product_table_name, "Operation", "GetItem", { label = "products GetItem" }],
            ["AWS/DynamoDB", "SuccessfulRequestLatency", "TableName", var.cart_table_name,    "Operation", "GetItem", { label = "cart GetItem" }],
            ["AWS/DynamoDB", "SuccessfulRequestLatency", "TableName", var.order_table_name,   "Operation", "Query",   { label = "orders Query" }],
            ["AWS/DynamoDB", "SuccessfulRequestLatency", "TableName", var.order_table_name,   "Operation", "PutItem", { label = "orders PutItem" }]
          ]
        }
      },

      # Row 7: S3
      {
        type   = "metric"
        x      = 0
        y      = 36
        width  = 8
        height = 6
        properties = {
          title   = "S3 frontend — request volume"
          view    = "timeSeries"
          region  = "ap-southeast-1"
          stat    = "Sum"
          period  = 300
          metrics = [
            ["AWS/S3", "GetRequests", "BucketName", var.frontend_bucket_name, "FilterId", "EntireBucket", { label = "GETs" }],
            ["AWS/S3", "PutRequests", "BucketName", var.frontend_bucket_name, "FilterId", "EntireBucket", { label = "PUTs" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 36
        width  = 8
        height = 6
        properties = {
          title   = "S3 product images — request volume"
          view    = "timeSeries"
          region  = "ap-southeast-1"
          stat    = "Sum"
          period  = 300
          metrics = [
            ["AWS/S3", "GetRequests", "BucketName", "flashmart-product-images", "FilterId", "EntireBucket", { label = "GETs" }],
            ["AWS/S3", "PutRequests", "BucketName", "flashmart-product-images", "FilterId", "EntireBucket", { label = "PUTs" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 36
        width  = 8
        height = 6
        properties = {
          title   = "S3 — errors (both buckets)"
          view    = "timeSeries"
          region  = "ap-southeast-1"
          stat    = "Sum"
          period  = 300
          metrics = [
            ["AWS/S3", "4xxErrors", "BucketName", var.frontend_bucket_name,   "FilterId", "EntireBucket", { label = "frontend 4xx" }],
            ["AWS/S3", "5xxErrors", "BucketName", var.frontend_bucket_name,   "FilterId", "EntireBucket", { label = "frontend 5xx" }],
            ["AWS/S3", "4xxErrors", "BucketName", "flashmart-product-images", "FilterId", "EntireBucket", { label = "images 4xx" }],
            ["AWS/S3", "5xxErrors", "BucketName", "flashmart-product-images", "FilterId", "EntireBucket", { label = "images 5xx" }]
          ]
        }
      },

      # Row 8: Alarm status
      {
        type   = "alarm"
        x      = 0
        y      = 42
        width  = 24
        height = 4
        properties = {
          title = "FlashMart alarm status"
          alarms = [
            aws_cloudwatch_metric_alarm.payment_failures_high.arn,
            aws_cloudwatch_metric_alarm.payment_lambda_duration.arn,
            aws_cloudwatch_metric_alarm.login_failures_high.arn,
            aws_cloudwatch_metric_alarm.lambda_errors["auth"].arn,
            aws_cloudwatch_metric_alarm.lambda_errors["payment"].arn,
            aws_cloudwatch_metric_alarm.lambda_errors["order"].arn,
            aws_cloudwatch_metric_alarm.lambda_errors["cart"].arn,
            aws_cloudwatch_metric_alarm.lambda_errors["product"].arn,
            aws_cloudwatch_metric_alarm.cf_5xx_rate.arn,
            aws_cloudwatch_metric_alarm.cf_cache_hit_low.arn,
            aws_cloudwatch_metric_alarm.dynamodb_read_throttles["orders"].arn,
            aws_cloudwatch_metric_alarm.dynamodb_write_throttles["payments"].arn,
            aws_cloudwatch_metric_alarm.s3_5xx_errors["frontend"].arn
          ]
        }
      }
    ]
  })
}
