#!/bin/bash
set -e

# Karpenter 설치 스크립트
# EKS 클러스터에 Karpenter를 설치하고 NodePool을 생성합니다.

CLUSTER_NAME="fans-cluster"
AWS_REGION="ap-northeast-2"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
KARPENTER_VERSION="v0.32.0"

echo "================================"
echo "Karpenter 설치 시작"
echo "================================"
echo "클러스터: $CLUSTER_NAME"
echo "리전: $AWS_REGION"
echo "계정 ID: $AWS_ACCOUNT_ID"
echo "Karpenter 버전: $KARPENTER_VERSION"
echo ""

# 1. Karpenter IAM Role 생성
echo "1. Karpenter IAM Role 생성 중..."

cat > karpenter-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# KarpenterNodeRole 생성
aws iam create-role \
  --role-name KarpenterNodeRole-${CLUSTER_NAME} \
  --assume-role-policy-document file://karpenter-trust-policy.json \
  --description "Karpenter Node Role for ${CLUSTER_NAME}" \
  || echo "Role already exists"

# 필요한 정책 연결
aws iam attach-role-policy \
  --role-name KarpenterNodeRole-${CLUSTER_NAME} \
  --policy-arn arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy

aws iam attach-role-policy \
  --role-name KarpenterNodeRole-${CLUSTER_NAME} \
  --policy-arn arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy

aws iam attach-role-policy \
  --role-name KarpenterNodeRole-${CLUSTER_NAME} \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly

aws iam attach-role-policy \
  --role-name KarpenterNodeRole-${CLUSTER_NAME} \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore

# 인스턴스 프로파일 생성
aws iam create-instance-profile \
  --instance-profile-name KarpenterNodeInstanceProfile-${CLUSTER_NAME} \
  || echo "Instance profile already exists"

aws iam add-role-to-instance-profile \
  --instance-profile-name KarpenterNodeInstanceProfile-${CLUSTER_NAME} \
  --role-name KarpenterNodeRole-${CLUSTER_NAME} \
  || echo "Role already added"

echo "✅ Karpenter Node Role 생성 완료"
echo ""

# 2. Karpenter Controller IAM Role 생성 (IRSA)
echo "2. Karpenter Controller IAM Role 생성 중..."

cat > karpenter-controller-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:CreateFleet",
        "ec2:CreateLaunchTemplate",
        "ec2:CreateTags",
        "ec2:DescribeAvailabilityZones",
        "ec2:DescribeImages",
        "ec2:DescribeInstances",
        "ec2:DescribeInstanceTypeOfferings",
        "ec2:DescribeInstanceTypes",
        "ec2:DescribeLaunchTemplates",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeSpotPriceHistory",
        "ec2:DescribeSubnets",
        "ec2:RunInstances",
        "ec2:TerminateInstances",
        "ec2:DeleteLaunchTemplate",
        "pricing:GetProducts",
        "ssm:GetParameter",
        "iam:PassRole",
        "eks:DescribeCluster"
      ],
      "Resource": "*"
    }
  ]
}
EOF

aws iam create-policy \
  --policy-name KarpenterControllerPolicy-${CLUSTER_NAME} \
  --policy-document file://karpenter-controller-policy.json \
  || echo "Policy already exists"

OIDC_PROVIDER=$(aws eks describe-cluster --name ${CLUSTER_NAME} --query "cluster.identity.oidc.issuer" --output text | sed -e "s/^https:\/\///")

cat > karpenter-controller-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/${OIDC_PROVIDER}"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "${OIDC_PROVIDER}:aud": "sts.amazonaws.com",
          "${OIDC_PROVIDER}:sub": "system:serviceaccount:karpenter:karpenter"
        }
      }
    }
  ]
}
EOF

aws iam create-role \
  --role-name KarpenterControllerRole-${CLUSTER_NAME} \
  --assume-role-policy-document file://karpenter-controller-trust-policy.json \
  || echo "Role already exists"

aws iam attach-role-policy \
  --role-name KarpenterControllerRole-${CLUSTER_NAME} \
  --policy-arn arn:aws:iam::${AWS_ACCOUNT_ID}:policy/KarpenterControllerPolicy-${CLUSTER_NAME}

echo "✅ Karpenter Controller Role 생성 완료"
echo ""

# 3. Karpenter Helm 설치
echo "3. Karpenter Helm 차트 설치 중..."

helm repo add karpenter https://charts.karpenter.sh
helm repo update

kubectl create namespace karpenter || echo "Namespace already exists"

helm upgrade --install karpenter karpenter/karpenter \
  --namespace karpenter \
  --version ${KARPENTER_VERSION} \
  --set settings.aws.clusterName=${CLUSTER_NAME} \
  --set settings.aws.defaultInstanceProfile=KarpenterNodeInstanceProfile-${CLUSTER_NAME} \
  --set settings.aws.interruptionQueueName=${CLUSTER_NAME} \
  --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=arn:aws:iam::${AWS_ACCOUNT_ID}:role/KarpenterControllerRole-${CLUSTER_NAME} \
  --set controller.resources.requests.cpu=1 \
  --set controller.resources.requests.memory=1Gi \
  --set controller.resources.limits.cpu=1 \
  --set controller.resources.limits.memory=1Gi \
  --wait

echo "✅ Karpenter 설치 완료"
echo ""

# 4. NodePool 및 EC2NodeClass 적용
echo "4. NodePool 및 EC2NodeClass 적용 중..."

kubectl apply -f ../karpenter/ec2nodeclass-default.yaml
kubectl apply -f ../karpenter/ec2nodeclass-ai-worker.yaml
kubectl apply -f ../karpenter/nodepool-general.yaml
kubectl apply -f ../karpenter/nodepool-ai-worker.yaml

echo "✅ NodePool 설정 완료"
echo ""

# 5. 확인
echo "5. Karpenter 상태 확인..."
echo ""
echo "Karpenter Pods:"
kubectl get pods -n karpenter

echo ""
echo "NodePools:"
kubectl get nodepools

echo ""
echo "EC2NodeClasses:"
kubectl get ec2nodeclasses

echo ""
echo "================================"
echo "✅ Karpenter 설치 완료!"
echo "================================"
echo ""
echo "다음 명령어로 Karpenter 로그 확인:"
echo "  kubectl logs -f -n karpenter -l app.kubernetes.io/name=karpenter"
echo ""
echo "NodePool 확인:"
echo "  kubectl get nodepools"
echo "  kubectl describe nodepool general"
echo "  kubectl describe nodepool ai-worker"

# 임시 파일 정리
rm -f karpenter-trust-policy.json karpenter-controller-policy.json karpenter-controller-trust-policy.json
