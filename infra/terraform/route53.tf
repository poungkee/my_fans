# Route53 Hosted Zone for fans.ai.kr
resource "aws_route53_zone" "fans_zone" {
  name = "fans.ai.kr"

  tags = {
    Name        = "FANS Hosted Zone"
    Environment = "production"
  }
}

# CNAME Record - www.fans.ai.kr pointing to LoadBalancer
resource "aws_route53_record" "fans_www_record" {
  zone_id = aws_route53_zone.fans_zone.zone_id
  name    = "www.fans.ai.kr"
  type    = "CNAME"
  ttl     = 300
  records = ["a43ebc0006dc4438f9b7bcb95151870c-579eb1cdf0e772db.elb.ap-northeast-2.amazonaws.com"]
}

# Output nameservers
output "route53_nameservers" {
  description = "Route53 nameservers for fans.ai.kr"
  value       = aws_route53_zone.fans_zone.name_servers
}

output "domain_url" {
  description = "Domain URL"
  value       = "http://fans.ai.kr"
}
