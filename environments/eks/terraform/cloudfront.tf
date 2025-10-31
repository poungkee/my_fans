# ==================================
# CloudFront CDN for S3 Static Assets
# ==================================

# CloudFront Origin Access Identity
resource "aws_cloudfront_origin_access_identity" "static_assets" {
  comment = "OAI for ${var.s3_bucket_name}"
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "static_assets" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "FANS Static Assets CDN"
  default_root_object = "index.html"
  price_class         = "PriceClass_200"  # US, Europe, Asia, Middle East, Africa

  # S3 Origin
  origin {
    domain_name = aws_s3_bucket.static_assets.bucket_regional_domain_name
    origin_id   = "S3-${var.s3_bucket_name}"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.static_assets.cloudfront_access_identity_path
    }
  }

  # Default Cache Behavior (Frontend)
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${var.s3_bucket_name}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600      # 1시간
    max_ttl                = 86400     # 24시간
    compress               = true
  }

  # Cache Behavior for /frontend/* (React App)
  ordered_cache_behavior {
    path_pattern     = "/frontend/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${var.s3_bucket_name}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
  }

  # Cache Behavior for /profiles/* (Profile Images - Long Cache)
  ordered_cache_behavior {
    path_pattern     = "/profiles/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${var.s3_bucket_name}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400     # 24시간
    max_ttl                = 31536000  # 1년
    compress               = true
  }

  # Restrictions
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # SSL Certificate
  viewer_certificate {
    cloudfront_default_certificate = true
    # custom_ssl_certificate_arn = "arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT_ID"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  # Custom Error Response (SPA Routing)
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/frontend/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/frontend/index.html"
  }

  tags = {
    Name        = "${var.cluster_name}-cdn"
    Environment = var.environment
  }
}
