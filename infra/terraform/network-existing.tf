# ========================================
# 기존 서브넷 사용 (새로 만들지 않음)
# VPC: vpc-065f338fa05a83693 (10.0.40.0/24)
# ========================================

# 기존 Private Subnet 1 (ap-northeast-2a)
data "aws_subnet" "existing_private_a" {
  id = "subnet-06757b076f0f530ad"
}

# 기존 Private Subnet 2 (ap-northeast-2c)
data "aws_subnet" "existing_private_b" {
  id = "subnet-0bde1d8b4bf53d696"
}

# ========================================
# Public Subnet 생성 (NAT/NLB용)
# 남은 IP 대역 사용: 10.0.40.0/27, 10.0.40.32/27
# ========================================

# Public Subnet A (AZ-2a)
resource "aws_subnet" "fans_public_a" {
  vpc_id                  = data.aws_vpc.existing.id
  cidr_block              = "10.0.40.0/27"  # 32 IPs
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = {
    Name        = "dw-FANS-Public-A"
    Environment = var.environment
    Project     = var.project_name
    Type        = "Public"
    AZ          = "${var.aws_region}a"
  }
}

# Public Subnet B (AZ-2c)
resource "aws_subnet" "fans_public_b" {
  vpc_id                  = data.aws_vpc.existing.id
  cidr_block              = "10.0.40.32/27"  # 32 IPs
  availability_zone       = "${var.aws_region}c"
  map_public_ip_on_launch = true

  tags = {
    Name        = "dw-FANS-Public-B"
    Environment = var.environment
    Project     = var.project_name
    Type        = "Public"
    AZ          = "${var.aws_region}c"
  }
}

# ========================================
# Private Subnet Alias (기존 서브넷 참조)
# ========================================

locals {
  fans_private_a_id = data.aws_subnet.existing_private_a.id
  fans_private_b_id = data.aws_subnet.existing_private_b.id
}

# ========================================
# NAT Gateway (비용 절감: 1개만 사용)
# Multi-AZ 대신 Single NAT로 월 $32 → $16 절감
# ========================================

# Elastic IP for NAT Gateway
resource "aws_eip" "nat" {
  domain = "vpc"

  tags = {
    Name        = "dw-FANS-NAT-EIP"
    Environment = var.environment
    Project     = var.project_name
  }
}

# NAT Gateway (1개만)
resource "aws_nat_gateway" "nat" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.fans_public_a.id

  tags = {
    Name        = "dw-FANS-NAT-Gateway"
    Environment = var.environment
    Project     = var.project_name
  }

  depends_on = [aws_internet_gateway.main]
}

# ========================================
# Route Tables
# ========================================

# Public Route Table
resource "aws_route_table" "public" {
  vpc_id = data.aws_vpc.existing.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name        = "dw-FANS-Public-RT"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Private Route Table (공용, NAT 1개만 사용)
resource "aws_route_table" "private" {
  vpc_id = data.aws_vpc.existing.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat.id
  }

  tags = {
    Name        = "dw-FANS-Private-RT"
    Environment = var.environment
    Project     = var.project_name
  }
}

# ========================================
# Route Table Associations
# ========================================

resource "aws_route_table_association" "public_a" {
  subnet_id      = aws_subnet.fans_public_a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_b" {
  subnet_id      = aws_subnet.fans_public_b.id
  route_table_id = aws_route_table.public.id
}

# 기존 Private Subnet에 Route Table 연결
resource "aws_route_table_association" "private_a" {
  subnet_id      = data.aws_subnet.existing_private_a.id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "private_b" {
  subnet_id      = data.aws_subnet.existing_private_b.id
  route_table_id = aws_route_table.private.id
}

# ========================================
# Outputs (다른 파일에서 참조용)
# ========================================

output "private_subnet_a_id" {
  value = data.aws_subnet.existing_private_a.id
}

output "private_subnet_b_id" {
  value = data.aws_subnet.existing_private_b.id
}

output "public_subnet_a_id" {
  value = aws_subnet.fans_public_a.id
}

output "public_subnet_b_id" {
  value = aws_subnet.fans_public_b.id
}
