# =============================================================================
# cloudfront.tf - CloudFront Distribution for Frontend
# =============================================================================

# ── CloudFront Distribution ───────────────────────────────────────────────────
resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100" # Use only cheapest regions

  comment = "${var.environment}-${var.project_name}-frontend"

  # ── Origin — S3 Website ────────────────────────────────────────────────────
  origin {
    domain_name = aws_s3_bucket_website_configuration.frontend.website_endpoint
    origin_id   = "S3-${var.frontend_bucket_name}"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only" # S3 website only supports HTTP
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # ── Default Cache Behavior ─────────────────────────────────────────────────
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${var.frontend_bucket_name}"
    viewer_protocol_policy = "redirect-to-https" # Force HTTPS

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600  # 1 hour cache
    max_ttl     = 86400 # 24 hours cache
  }

  # ── SPA Routing Fix ────────────────────────────────────────────────────────
  # React Router needs this — return index.html for all 404s
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  # ── Geo Restrictions — None ────────────────────────────────────────────────
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # ── SSL Certificate ────────────────────────────────────────────────────────
  viewer_certificate {
    cloudfront_default_certificate = true # Use free CloudFront certificate
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }

  depends_on = [aws_s3_bucket_website_configuration.frontend]
}