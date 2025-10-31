# EKS 클러스터
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = var.cluster_name
  cluster_version = var.cluster_version

  # 클러스터 엔드포인트 설정
  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  # VPC 및 서브넷 (Multi-AZ: 2a, 2b)
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets
  control_plane_subnet_ids = module.vpc.private_subnets

  # OIDC Provider 활성화 (IRSA, Karpenter를 위해 필요)
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
      service_account_role_arn = module.ebs_csi_irsa.iam_role_arn
    }
  }

  # Karpenter를 위한 클러스터 액세스 설정
  enable_cluster_creator_admin_permissions = true

  # Dashboard 및 관리자를 위한 액세스 엔트리
  access_entries = {
    karpenter = {
      kubernetes_groups = []
      principal_arn     = module.karpenter.iam_role_arn

      policy_associations = {
        karpenter = {
          policy_arn = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
          access_scope = {
            type = "cluster"
          }
        }
      }
    }
  }

  # EKS Managed Node Groups (t3.large × 2 for Main API, Crawler, AI Services)
  eks_managed_node_groups = {
    main_workers = {
      name = "fans-main-workers"

      instance_types = ["t3.large"]
      capacity_type  = "ON_DEMAND"

      # Multi-AZ 배포 (2a, 2b에 각각 1개씩)
      min_size     = 2
      max_size     = 4
      desired_size = 2

      disk_size = 50
      disk_type = "gp3"

      labels = {
        role        = "main-worker"
        workload    = "api-crawler-ai"
        karpenter   = "false"
      }

      taints = []  # Karpenter가 관리하는 AI Worker와 구분

      tags = {
        NodeGroup   = "fans-main-workers"
        Environment = var.environment
        Karpenter   = "false"
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
    Project     = "FANS"
  }
}

# ==================================
# EBS CSI Driver IRSA
# ==================================
module "ebs_csi_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name = "${var.cluster_name}-ebs-csi-driver"

  attach_ebs_csi_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:ebs-csi-controller-sa"]
    }
  }

  tags = {
    Environment = var.environment
  }
}

# ==================================
# Karpenter
# ==================================
module "karpenter" {
  source  = "terraform-aws-modules/eks/aws//modules/karpenter"
  version = "~> 20.0"

  cluster_name = module.eks.cluster_name

  enable_irsa                     = true
  irsa_oidc_provider_arn          = module.eks.oidc_provider_arn
  irsa_namespace_service_accounts = ["karpenter:karpenter"]

  create_node_iam_role = false
  node_iam_role_arn    = module.eks.eks_managed_node_groups["main_workers"].iam_role_arn

  # EKS Access Entry 충돌 방지
  create_access_entry = false

  tags = {
    Environment = var.environment
  }
}

# IAM 역할에 추가 정책 연결 (S3 접근)
resource "aws_iam_role_policy_attachment" "node_s3_policy" {
  for_each = module.eks.eks_managed_node_groups

  role       = each.value.iam_role_name
  policy_arn = aws_iam_policy.s3_access.arn
}

resource "aws_iam_policy" "s3_access" {
  name        = "${var.cluster_name}-s3-access"
  description = "S3 access policy for FANS static assets"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:PutObjectAcl"
        ]
        Resource = "arn:aws:s3:::${var.s3_bucket_name}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = "arn:aws:s3:::${var.s3_bucket_name}"
      }
    ]
  })
}
