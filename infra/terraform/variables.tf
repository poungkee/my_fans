# FANS Terraform Variables

variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "ap-northeast-2"
}

variable "existing_vpc_id" {
  description = "Existing VPC ID"
  type        = string
  default     = "vpc-065f338fa05a83693"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "FANS"
}

variable "environment" {
  description = "Environment"
  type        = string
  default     = "production"
}

# EKS Variables
variable "eks_cluster_name" {
  description = "EKS Cluster name"
  type        = string
  default     = "dw-fans-prod-eks"
}

variable "eks_version" {
  description = "EKS Kubernetes version"
  type        = string
  default     = "1.28"
}

variable "node_capacity_type" {
  description = "EKS node capacity type (ON_DEMAND or SPOT)"
  type        = string
  default     = "SPOT"
}

variable "node_instance_types" {
  description = "EKS node instance types"
  type        = list(string)
  default     = ["t3.medium", "t3a.medium", "t2.medium"]
}

variable "node_desired_size" {
  description = "Desired number of EKS nodes"
  type        = number
  default     = 2
}

variable "node_min_size" {
  description = "Minimum number of EKS nodes"
  type        = number
  default     = 1
}

variable "node_max_size" {
  description = "Maximum number of EKS nodes"
  type        = number
  default     = 4
}

variable "node_disk_size" {
  description = "EKS node disk size in GB"
  type        = number
  default     = 30
}

# RDS Variables
variable "use_rds" {
  description = "Whether to create RDS instance"
  type        = bool
  default     = true
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_storage_type" {
  description = "RDS storage type"
  type        = string
  default     = "gp3"
}

variable "db_multi_az" {
  description = "Enable RDS Multi-AZ"
  type        = bool
  default     = false
}

variable "db_backup_retention" {
  description = "RDS backup retention period in days"
  type        = number
  default     = 7
}

variable "db_name" {
  description = "RDS database name"
  type        = string
  default     = "fans_db"
}

variable "db_username" {
  description = "RDS master username"
  type        = string
  default     = "fans_admin"
}

variable "db_password" {
  description = "RDS master password"
  type        = string
  sensitive   = true
}

# Redis Variables
variable "use_elasticache" {
  description = "Whether to create ElastiCache"
  type        = bool
  default     = false
}

variable "redis_ebs_size" {
  description = "Redis EBS volume size in GB (for Pod deployment)"
  type        = number
  default     = 5
}

# Load Balancer Variables
variable "load_balancer_type" {
  description = "Load balancer type (alb or nlb)"
  type        = string
  default     = "nlb"
}

variable "enable_https" {
  description = "Enable HTTPS on load balancer"
  type        = bool
  default     = true
}

# ECR Variables
variable "ecr_repositories" {
  description = "List of ECR repository names"
  type        = list(string)
  default     = []
}

variable "ecr_image_retention_count" {
  description = "Number of images to retain in ECR"
  type        = number
  default     = 10
}

# Monitoring Variables
variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

variable "enable_container_insights" {
  description = "Enable EKS Container Insights"
  type        = bool
  default     = false
}

variable "enable_karpenter" {
  description = "Enable Karpenter auto-scaler"
  type        = bool
  default     = true
}

# Tags
variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {
    Environment = "production"
    Project     = "FANS"
    ManagedBy   = "Terraform"
  }
}
