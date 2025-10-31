# ==================================
# S3 Bucket for Static Assets
# Frontend + Profile Images
# ==================================

resource "aws_s3_bucket" "static_assets" {
  bucket = var.s3_bucket_name

  tags = {
    Name        = var.s3_bucket_name
    Environment = var.environment
    Purpose     = "Frontend and Profile Images"
  }
}

# S3 버킷 소유권 제어
resource "aws_s3_bucket_ownership_controls" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

# S3 버킷 Public Access Block 설정
resource "aws_s3_bucket_public_access_block" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# S3 버킷 ACL (CloudFront OAI용)
resource "aws_s3_bucket_acl" "static_assets" {
  depends_on = [
    aws_s3_bucket_ownership_controls.static_assets,
    aws_s3_bucket_public_access_block.static_assets,
  ]

  bucket = aws_s3_bucket.static_assets.id
  acl    = "private"
}

# S3 버킷 정책 (CloudFront OAI만 접근 가능)
resource "aws_s3_bucket_policy" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontOAI"
        Effect = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.static_assets.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.static_assets.arn}/*"
      }
    ]
  })
}

# S3 버킷 버저닝
resource "aws_s3_bucket_versioning" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  versioning_configuration {
    status = "Enabled"
  }
}

# S3 버킷 CORS 설정
resource "aws_s3_bucket_cors_configuration" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD", "PUT", "POST"]
    allowed_origins = ["*"]  # Production에서는 도메인으로 제한
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# S3 라이프사이클 정책 (오래된 버전 삭제)
resource "aws_s3_bucket_lifecycle_configuration" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  rule {
    id     = "delete-old-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}
