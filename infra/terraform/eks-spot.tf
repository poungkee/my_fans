# ========================================
# EKS Node Group with Spot Instances
# 70% 비용 절감을 위한 Spot Instance 설정
# ========================================

resource "aws_eks_node_group" "spot" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${var.project_name}-spot-nodes"
  node_role_arn   = aws_iam_role.eks_nodes.arn

  # Private Subnet만 사용 (보안) - 기존 서브넷 활용
  subnet_ids = [
    data.aws_subnet.existing_private_a.id,
    data.aws_subnet.existing_private_b.id
  ]

  # Spot Instance 설정 (70% 할인)
  capacity_type = var.node_capacity_type  # SPOT

  # 여러 인스턴스 타입 지정 (중단 위험 분산)
  instance_types = var.node_instance_types

  # 스케일링 설정
  scaling_config {
    desired_size = var.node_desired_size  # 2
    max_size     = var.node_max_size      # 4
    min_size     = var.node_min_size      # 1
  }

  # 디스크 설정
  disk_size = var.node_disk_size  # 30GB

  # 업데이트 설정 (롤링 업데이트)
  update_config {
    max_unavailable = 1  # 한 번에 1대씩만 업데이트
  }

  # 라벨 (Pod 스케줄링용)
  labels = {
    role        = "worker"
    capacity    = "spot"
    environment = var.environment
  }

  # Taint (Spot 전용 워크로드만 실행)
  # taint {
  #   key    = "spot"
  #   value  = "true"
  #   effect = "NoSchedule"
  # }

  # Launch Template (상세 설정)
  launch_template {
    id      = aws_launch_template.eks_nodes.id
    version = "$Latest"
  }

  # 의존성
  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_container_registry_policy,
  ]

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-spot-nodes"
      Type = "spot"
    }
  )

  # Spot Instance 중단 시 자동 대체
  lifecycle {
    create_before_destroy = true
    ignore_changes        = [scaling_config[0].desired_size]
  }
}

# ========================================
# Launch Template (노드 상세 설정)
# ========================================

resource "aws_launch_template" "eks_nodes" {
  name_prefix = "${var.project_name}-node-"
  description = "Launch template for EKS nodes"

  # AMI는 EKS 최적화 이미지 자동 선택
  image_id = data.aws_ami.eks_node.id

  # 인스턴스 타입 (여러 개 지정 가능)
  # instance_type은 node_group에서 설정

  # 키 페어 (SSH 접속용, 선택)
  # key_name = "your-key-pair"

  # 보안 그룹
  vpc_security_group_ids = [aws_security_group.eks_nodes.id]

  # 블록 디바이스 설정
  block_device_mappings {
    device_name = "/dev/xvda"

    ebs {
      volume_size           = var.node_disk_size
      volume_type           = "gp3"
      iops                  = 3000
      throughput            = 125
      delete_on_termination = true
      encrypted             = true
    }
  }

  # 메타데이터 설정 (보안 강화)
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"  # IMDSv2 강제
    http_put_response_hop_limit = 1
  }

  # 모니터링
  monitoring {
    enabled = true
  }

  # Spot Instance 중단 핸들러
  # instance_market_options {
  #   market_type = "spot"
  # }

  # 사용자 데이터 (부팅 시 실행)
  user_data = base64encode(templatefile("${path.module}/user-data.sh", {
    cluster_name     = var.eks_cluster_name
    cluster_endpoint = aws_eks_cluster.main.endpoint
    cluster_ca       = aws_eks_cluster.main.certificate_authority[0].data
  }))

  tag_specifications {
    resource_type = "instance"
    tags = merge(
      var.tags,
      {
        Name = "${var.project_name}-eks-node"
      }
    )
  }

  tag_specifications {
    resource_type = "volume"
    tags = merge(
      var.tags,
      {
        Name = "${var.project_name}-eks-volume"
      }
    )
  }
}

# ========================================
# EKS 최적화 AMI 조회
# ========================================

data "aws_ami" "eks_node" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amazon-eks-node-${var.eks_version}-v*"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

# ========================================
# Outputs
# ========================================

output "node_group_id" {
  description = "EKS Node Group ID"
  value       = aws_eks_node_group.spot.id
}

output "node_group_status" {
  description = "EKS Node Group 상태"
  value       = aws_eks_node_group.spot.status
}

output "node_instance_types" {
  description = "사용 중인 인스턴스 타입"
  value       = aws_eks_node_group.spot.instance_types
}
