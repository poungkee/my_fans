# ==================================
# ACM Certificate (SSL/TLS)
# ==================================

# SSL/TLS 인증서 생성
resource "aws_acm_certificate" "main" {
  domain_name               = "fans.ai.kr"
  subject_alternative_names = ["www.fans.ai.kr", "*.fans.ai.kr"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "${var.cluster_name}-certificate"
    Environment = var.environment
  }
}

# 인증서 검증 대기
resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]

  timeouts {
    create = "10m"
  }
}
