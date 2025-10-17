# ========================================
# RDS PostgreSQL (최소 비용 설정)
# db.t4g.micro + Single-AZ = 월 $15
# ========================================

resource "aws_db_instance" "postgres" {
  count = var.use_rds ? 1 : 0

  # 기본 설정
  identifier     = "${lower(var.project_name)}-postgres"
  engine         = "postgres"
  engine_version = "15.4"  # 최신 안정 버전

  # 인스턴스 클래스 (ARM 프로세서 = 20% 저렴)
  instance_class = var.db_instance_class  # db.t4g.micro

  # 스토리지
  allocated_storage     = var.db_allocated_storage  # 20GB
  max_allocated_storage = 50  # 자동 확장 최대 50GB
  storage_type          = var.db_storage_type  # gp3
  storage_encrypted     = true

  # 데이터베이스
  db_name  = var.db_name      # fans_db
  username = var.db_username  # fans_admin
  password = var.db_password  # Terraform apply 시 입력
  port     = 5432

  # 네트워크
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  # 고가용성 (비용 절감을 위해 Single-AZ)
  multi_az = var.db_multi_az  # false

  # 백업
  backup_retention_period = var.db_backup_retention  # 7일
  backup_window           = "03:00-04:00"  # 새벽 3~4시 (UTC)
  copy_tags_to_snapshot   = true
  skip_final_snapshot     = false
  final_snapshot_identifier = "${var.project_name}-postgres-final-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  # 유지보수
  maintenance_window      = "mon:04:00-mon:05:00"  # 월요일 새벽
  auto_minor_version_upgrade = true

  # 성능 인사이트 (비용 절감을 위해 비활성화)
  enabled_cloudwatch_logs_exports = ["postgresql"]
  performance_insights_enabled    = false

  # 파라미터 그룹
  parameter_group_name = aws_db_parameter_group.postgres.name

  # 삭제 보호 (프로덕션에서는 true 권장)
  deletion_protection = false

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-postgres"
    }
  )
}

# ========================================
# DB Subnet Group
# ========================================

resource "aws_db_subnet_group" "main" {
  name       = "${lower(var.project_name)}-db-subnet-group"
  subnet_ids = [
    data.aws_subnet.existing_private_a.id,
    data.aws_subnet.existing_private_b.id
  ]

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-db-subnet-group"
    }
  )
}

# ========================================
# DB Parameter Group (최적화)
# ========================================

resource "aws_db_parameter_group" "postgres" {
  name   = "${lower(var.project_name)}-postgres-params"
  family = "postgres15"

  # 연결 풀링 최적화
  parameter {
    name  = "max_connections"
    value = "100"
  }

  # 메모리 설정 (t4g.micro는 1GB RAM)
  parameter {
    name  = "shared_buffers"
    value = "{DBInstanceClassMemory/32768}"  # RAM의 25%
  }

  parameter {
    name  = "effective_cache_size"
    value = "{DBInstanceClassMemory/16384}"  # RAM의 50%
  }

  # 로깅 (디버깅용)
  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    name  = "log_duration"
    value = "1"
  }

  # 느린 쿼리 로깅
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"  # 1초 이상 쿼리
  }

  tags = var.tags
}

# ========================================
# RDS Security Group
# ========================================

resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = data.aws_vpc.existing.id

  # EKS 노드에서 접속 허용
  ingress {
    description     = "PostgreSQL from EKS nodes"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }

  # 아웃바운드 전체 허용
  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-rds-sg"
    }
  )
}

# ========================================
# Outputs
# ========================================

output "rds_endpoint" {
  description = "RDS 엔드포인트"
  value       = var.use_rds ? aws_db_instance.postgres[0].endpoint : "N/A"
}

output "rds_address" {
  description = "RDS 주소"
  value       = var.use_rds ? aws_db_instance.postgres[0].address : "N/A"
}

output "rds_port" {
  description = "RDS 포트"
  value       = var.use_rds ? aws_db_instance.postgres[0].port : 0
}

output "rds_db_name" {
  description = "데이터베이스 이름"
  value       = var.use_rds ? aws_db_instance.postgres[0].db_name : "N/A"
}

output "rds_username" {
  description = "데이터베이스 사용자명"
  value       = var.use_rds ? aws_db_instance.postgres[0].username : "N/A"
  sensitive   = true
}
