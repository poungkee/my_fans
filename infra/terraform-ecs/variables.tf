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
  description = "ECS Cluster name"
  type        = string
  default     = "fans-ecs-cluster"
}

variable "vpc_id" {
  description = "VPC ID (if using existing VPC)"
  type        = string
  default     = ""
}

variable "subnet_ids" {
  description = "Subnet IDs for ECS tasks"
  type        = list(string)
  default     = []
}
