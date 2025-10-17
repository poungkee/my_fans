# ========================================
# ECR (Elastic Container Registry)
# Docker 이미지 저장소
# ========================================

# ECR 리포지토리 생성
resource "aws_ecr_repository" "repos" {
  for_each = toset(var.ecr_repositories)

  name                 = each.value
  image_tag_mutability = "MUTABLE"

  # 이미지 스캔 (보안)
  image_scanning_configuration {
    scan_on_push = true
  }

  # 암호화
  encryption_configuration {
    encryption_type = "AES256"  # KMS 대신 AES256 (무료)
  }

  tags = merge(
    var.tags,
    {
      Name = each.value
    }
  )
}

# ========================================
# Lifecycle Policy (비용 절감)
# 오래된 이미지 자동 삭제
# ========================================

resource "aws_ecr_lifecycle_policy" "cleanup" {
  for_each = aws_ecr_repository.repos

  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "최근 ${var.ecr_image_retention_count}개 이미지만 보관"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = var.ecr_image_retention_count
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# ========================================
# Repository Policy (권한 설정)
# ========================================

resource "aws_ecr_repository_policy" "allow_eks" {
  for_each = aws_ecr_repository.repos

  repository = each.value.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowEKSPull"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.eks_nodes.arn
        }
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability"
        ]
      }
    ]
  })
}

# ========================================
# Outputs
# ========================================

output "ecr_repository_urls" {
  description = "ECR 리포지토리 URL 목록"
  value = {
    for repo in aws_ecr_repository.repos :
    repo.name => repo.repository_url
  }
}

output "ecr_registry_id" {
  description = "ECR 레지스트리 ID"
  value       = length(aws_ecr_repository.repos) > 0 ? values(aws_ecr_repository.repos)[0].registry_id : null
}

output "ecr_registry_url" {
  description = "ECR 레지스트리 URL"
  value       = length(aws_ecr_repository.repos) > 0 ? "${values(aws_ecr_repository.repos)[0].registry_id}.dkr.ecr.${var.aws_region}.amazonaws.com" : null
}
