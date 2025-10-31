variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "ap-northeast-2"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "cluster_name" {
  description = "EKS Cluster name"
  type        = string
  default     = "fans-cluster"
}

variable "cluster_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.31"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnets"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use single NAT Gateway (false = 2 NAT Gateways for Multi-AZ)"
  type        = bool
  default     = false
}

variable "db_username" {
  description = "RDS master username"
  type        = string
  default     = "fans_user"
  sensitive   = true
}

variable "db_password" {
  description = "RDS master password"
  type        = string
  sensitive   = true
}

variable "db_name" {
  description = "RDS database name"
  type        = string
  default     = "fans_db"
}

variable "s3_bucket_name" {
  description = "S3 bucket name for static assets"
  type        = string
  default     = "fans-static-assets"
}
