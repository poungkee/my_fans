# ==================================
# ElastiCache Redis (Multi-AZ)
# BullMQ Backend
# ==================================

# ElastiCache 보안 그룹
resource "aws_security_group" "elasticache" {
  name_prefix = "${var.cluster_name}-elasticache-sg"
  description = "Security group for ElastiCache Redis"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "Redis from EKS nodes"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.cluster_name}-elasticache-sg"
    Environment = var.environment
  }
}

# ElastiCache Redis Replication Group (Multi-AZ)
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${var.cluster_name}-redis"
  description          = "Redis for BullMQ (Multi-AZ)"

  # 엔진 설정
  engine               = "redis"
  engine_version       = "7.0"
  node_type            = "cache.t3.micro"
  port                 = 6379

  # Multi-AZ 설정 (Primary: 2a, Replica: 2b)
  num_cache_clusters         = 2
  automatic_failover_enabled = true
  multi_az_enabled           = true

  # 서브넷 설정
  subnet_group_name = module.vpc.elasticache_subnet_group_name

  # 보안 그룹
  security_group_ids = [aws_security_group.elasticache.id]

  # 파라미터 그룹
  parameter_group_name = aws_elasticache_parameter_group.redis.name

  # 백업 설정
  snapshot_retention_limit = 5
  snapshot_window          = "03:00-05:00"  # UTC 기준
  maintenance_window       = "mon:05:00-mon:07:00"

  # 암호화
  at_rest_encryption_enabled = true
  transit_encryption_enabled = false  # BullMQ 호환성을 위해 비활성화

  # 알림
  notification_topic_arn = null

  # 자동 minor 버전 업그레이드
  auto_minor_version_upgrade = true

  tags = {
    Name        = "${var.cluster_name}-redis"
    Environment = var.environment
    Purpose     = "BullMQ"
  }
}

# ElastiCache 파라미터 그룹 (Redis 7.0 최적화)
resource "aws_elasticache_parameter_group" "redis" {
  name   = "${var.cluster_name}-redis-7"
  family = "redis7"

  # 메모리 관리 (maxmemory-policy)
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"  # BullMQ에 적합
  }

  # 연결 타임아웃
  parameter {
    name  = "timeout"
    value = "300"
  }

  # TCP keepalive
  parameter {
    name  = "tcp-keepalive"
    value = "60"
  }

  tags = {
    Name        = "${var.cluster_name}-redis-params"
    Environment = var.environment
  }
}
