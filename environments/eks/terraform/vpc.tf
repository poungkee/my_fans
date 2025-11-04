# VPC 구성 (Multi-AZ: 2a, 2b)
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${var.cluster_name}-vpc"
  cidr = var.vpc_cidr

  # Multi-AZ 구성: ap-northeast-2a, 2b (2개의 AZ만 사용)
  azs = ["${var.aws_region}a", "${var.aws_region}b"]

  # Private Subnets (Worker Nodes)
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]

  # Public Subnets (NAT Gateway, Load Balancer)
  public_subnets = ["10.0.101.0/24", "10.0.102.0/24"]

  # Database Subnets (RDS)
  database_subnets = ["10.0.201.0/24", "10.0.202.0/24"]
  create_database_subnet_group = true

  # ElastiCache Subnets (Redis)
  elasticache_subnets = ["10.0.211.0/24", "10.0.212.0/24"]
  create_elasticache_subnet_group = true

  # NAT Gateway 설정 (2개 - 각 AZ마다 하나씩)
  enable_nat_gateway   = var.enable_nat_gateway
  single_nat_gateway   = var.single_nat_gateway  # false = 2개
  one_nat_gateway_per_az = true  # 각 AZ당 하나

  enable_dns_hostnames = true
  enable_dns_support   = true

  # EKS 태그 (클러스터 서브넷 발견을 위해 필요)
  public_subnet_tags = {
    "kubernetes.io/role/elb"                    = "1"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb"           = "1"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
    "karpenter.sh/discovery"                    = var.cluster_name
  }

  database_subnet_tags = {
    "Name" = "${var.cluster_name}-database-subnet"
  }

  elasticache_subnet_tags = {
    "Name" = "${var.cluster_name}-elasticache-subnet"
  }

  tags = {
    Name        = "${var.cluster_name}-vpc"
    Environment = var.environment
    Project     = "FANS"
  }
}
