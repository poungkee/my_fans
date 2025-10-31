# ==================================
# RDS PostgreSQL 15 (Multi-AZ)
# ==================================

# RDS 보안 그룹
resource "aws_security_group" "rds" {
  name_prefix = "${var.cluster_name}-rds-sg"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "PostgreSQL from EKS nodes"
    from_port       = 5432
    to_port         = 5432
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
    Name        = "${var.cluster_name}-rds-sg"
    Environment = var.environment
  }
}

# RDS PostgreSQL 인스턴스
resource "aws_db_instance" "postgres" {
  identifier = "${var.cluster_name}-postgres"

  # 엔진 설정
  engine               = "postgres"
  engine_version       = "15.14"
  instance_class       = "db.t3.medium"
  allocated_storage    = 100
  storage_type         = "gp3"
  storage_encrypted    = true

  # 데이터베이스 설정
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  port     = 5432

  # Multi-AZ 설정 (Primary: 2a, Standby: 2b)
  multi_az               = true
  db_subnet_group_name   = module.vpc.database_subnet_group_name
  vpc_security_group_ids = [aws_security_group.rds.id]

  # 백업 설정
  backup_retention_period = 7
  backup_window          = "03:00-04:00"  # UTC 기준 (한국 시간 12:00-13:00)
  maintenance_window     = "mon:04:00-mon:05:00"

  # 성능 개선
  performance_insights_enabled = true
  performance_insights_retention_period = 7

  # 삭제 보호
  deletion_protection = true
  skip_final_snapshot = false
  final_snapshot_identifier = "${var.cluster_name}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  # 파라미터 그룹 (기본 parameter group 사용)
  # parameter_group_name = aws_db_parameter_group.postgres.name

  tags = {
    Name        = "${var.cluster_name}-postgres"
    Environment = var.environment
  }
}

# RDS 파라미터 그룹 (기본 사용)
# 참고: Custom parameter group은 static parameter 문제로 인해 제거됨
# AWS 기본 parameter group 사용 권장
#
# resource "aws_db_parameter_group" "postgres" {
#   name   = "${var.cluster_name}-postgres-15-v2"
#   family = "postgres15"
#
#   # 연결 최적화
#   parameter {
#     name  = "max_connections"
#     value = "200"
#   }
#
#   # 쿼리 성능
#   parameter {
#     name  = "work_mem"
#     value = "10240"  # 10MB
#   }
#
#   parameter {
#     name  = "maintenance_work_mem"
#     value = "524288"  # 512MB
#   }
#
#   # 로깅
#   parameter {
#     name  = "log_min_duration_statement"
#     value = "1000"  # 1초 이상 쿼리 로깅
#   }
#
#   tags = {
#     Name        = "${var.cluster_name}-postgres-params"
#     Environment = var.environment
#   }
# }
