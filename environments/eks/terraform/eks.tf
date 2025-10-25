# EKS 클러스터
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = var.cluster_name
  cluster_version = var.cluster_version

  # 클러스터 엔드포인트 설정
  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  # VPC 및 서브넷
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  # OIDC Provider 활성화 (IRSA를 위해 필요)
  enable_irsa = true

  # 클러스터 로깅
  cluster_enabled_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  # 클러스터 애드온
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }

  # EKS Managed Node Groups
  eks_managed_node_groups = {
    # Medium 노드 그룹 (일반 워크로드용)
    medium = {
      name = "fans-private-medium"

      instance_types = ["t3.medium"]
      capacity_type  = "ON_DEMAND"

      min_size     = 2
      max_size     = 5
      desired_size = 3

      disk_size = 30
      disk_type = "gp3"

      labels = {
        role = "worker"
        size = "medium"
      }

      tags = {
        NodeGroup = "fans-private-medium"
      }
    }

    # Large 노드 그룹 (무거운 워크로드용)
    large = {
      name = "fans-private-large"

      instance_types = ["t3.large"]
      capacity_type  = "ON_DEMAND"

      min_size     = 2
      max_size     = 5
      desired_size = 3

      disk_size = 30
      disk_type = "gp3"

      labels = {
        role = "worker"
        size = "large"
      }

      tags = {
        NodeGroup = "fans-private-large"
      }
    }
  }

  # 노드 보안 그룹 규칙
  node_security_group_additional_rules = {
    ingress_self_all = {
      description = "Node to node all ports/protocols"
      protocol    = "-1"
      from_port   = 0
      to_port     = 0
      type        = "ingress"
      self        = true
    }
    egress_all = {
      description      = "Node all egress"
      protocol         = "-1"
      from_port        = 0
      to_port          = 0
      type             = "egress"
      cidr_blocks      = ["0.0.0.0/0"]
      ipv6_cidr_blocks = ["::/0"]
    }
  }

  tags = {
    Environment = var.environment
  }
}

# IAM 역할에 추가 정책 연결 (S3, ALB, CloudWatch 등)
resource "aws_iam_role_policy_attachment" "node_s3_policy" {
  for_each = module.eks.eks_managed_node_groups

  role       = each.value.iam_role_name
  policy_arn = aws_iam_policy.s3_access.arn
}

resource "aws_iam_policy" "s3_access" {
  name        = "FANSProfileImagesS3Access"
  description = "S3 access policy for FANS profile images"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = "arn:aws:s3:::fans-profile-images-907123164281/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = "arn:aws:s3:::fans-profile-images-907123164281"
      }
    ]
  })
}
