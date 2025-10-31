# ==================================
# Route 53 DNS Configuration
# ==================================

# Hosted Zone 데이터 소스 (이미 존재하는 zone)
data "aws_route53_zone" "main" {
  name         = "fans.ai.kr."
  private_zone = false
}

# www.fans.ai.kr → ALB A 레코드
resource "aws_route53_record" "www" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "www.fans.ai.kr"
  type    = "A"

  allow_overwrite = true

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# fans.ai.kr → www.fans.ai.kr 리다이렉트를 위한 A 레코드
resource "aws_route53_record" "root" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "fans.ai.kr"
  type    = "A"

  allow_overwrite = true

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# ACM 인증서 검증을 위한 레코드
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.main.zone_id
}
