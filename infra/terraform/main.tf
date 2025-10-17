# FANS AWS Infrastructure - Terraform Configuration
# 기존 VPC (10.0.30.0/24) 활용

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ============================================
# 기존 리소스 Import (Data Source)
# ============================================

# 기존 VPC
data "aws_vpc" "existing" {
  id = var.existing_vpc_id # vpc-0fa60f4833b7932ad
}

# Internet Gateway (생성)
resource "aws_internet_gateway" "main" {
  vpc_id = data.aws_vpc.existing.id

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-igw"
    }
  )
}
