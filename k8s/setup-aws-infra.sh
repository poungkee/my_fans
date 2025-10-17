#!/bin/bash
# AWS EKS 인프라 설정 스크립트

set -e

# 변수 설정
export AWS_REGION="ap-northeast-2"  # 서울 리전
export CLUSTER_NAME="fans-eks-cluster"
export DOMAIN="fans.ai.kr"
export ECR_REPOSITORY_PREFIX="fans"

echo "=========================================="
echo "FANS EKS Infrastructure Setup"
echo "=========================================="
echo "Region: $AWS_REGION"
echo "Cluster: $CLUSTER_NAME"
echo "Domain: $DOMAIN"
echo "=========================================="

# 1. Route 53 호스팅 영역 확인
echo ""
echo "Step 1: Checking Route 53 Hosted Zone..."
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name "$DOMAIN" \
  --query "HostedZones[0].Id" \
  --output text | sed 's|/hostedzone/||')

if [ "$HOSTED_ZONE_ID" = "None" ] || [ -z "$HOSTED_ZONE_ID" ]; then
  echo "❌ Hosted Zone not found for $DOMAIN"
  echo "Please create a hosted zone first:"
  echo "aws route53 create-hosted-zone --name $DOMAIN --caller-reference \$(date +%s)"
  exit 1
else
  echo "✅ Hosted Zone found: $HOSTED_ZONE_ID"
fi

# 2. ACM 인증서 요청
echo ""
echo "Step 2: Requesting ACM Certificate..."
CERT_ARN=$(aws acm request-certificate \
  --region $AWS_REGION \
  --domain-name "$DOMAIN" \
  --subject-alternative-names "*.${DOMAIN}" \
  --validation-method DNS \
  --query "CertificateArn" \
  --output text)

echo "✅ Certificate requested: $CERT_ARN"
echo "⚠️  You need to add DNS validation records to Route 53"
echo "    Run: aws acm describe-certificate --certificate-arn $CERT_ARN --region $AWS_REGION"

# 3. ECR 리포지토리 생성
echo ""
echo "Step 3: Creating ECR Repositories..."

SERVICES=(
  "main-api"
  "frontend"
  "api-crawler"
  "classification-api"
  "summarize-ai"
  "bias-analysis-ai"
  "scheduler"
)

for SERVICE in "${SERVICES[@]}"; do
  REPO_NAME="${ECR_REPOSITORY_PREFIX}-${SERVICE}"

  if aws ecr describe-repositories --repository-names "$REPO_NAME" --region $AWS_REGION >/dev/null 2>&1; then
    echo "  ℹ️  Repository already exists: $REPO_NAME"
  else
    aws ecr create-repository \
      --repository-name "$REPO_NAME" \
      --region $AWS_REGION \
      --image-scanning-configuration scanOnPush=true \
      --encryption-configuration encryptionType=AES256 >/dev/null
    echo "  ✅ Created repository: $REPO_NAME"
  fi
done

# 4. EKS 클러스터 생성 (eksctl 사용)
echo ""
echo "Step 4: Creating EKS Cluster..."
echo "⚠️  This will take 15-20 minutes"

cat > eks-cluster-config.yaml <<EOF
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: $CLUSTER_NAME
  region: $AWS_REGION
  version: "1.28"

managedNodeGroups:
  - name: fans-nodegroup-1
    instanceType: t3.medium
    desiredCapacity: 3
    minSize: 2
    maxSize: 5
    volumeSize: 30
    ssh:
      allow: false
    labels:
      role: worker
    tags:
      Environment: production
      Project: FANS

  - name: fans-ai-nodegroup
    instanceType: t3.large
    desiredCapacity: 2
    minSize: 1
    maxSize: 3
    volumeSize: 50
    labels:
      role: ai-worker
      workload: ai
    tags:
      Environment: production
      Project: FANS

iam:
  withOIDC: true
  serviceAccounts:
    - metadata:
        name: aws-load-balancer-controller
        namespace: kube-system
      wellKnownPolicies:
        awsLoadBalancerController: true
EOF

if eksctl get cluster --name "$CLUSTER_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
  echo "  ℹ️  Cluster already exists: $CLUSTER_NAME"
else
  eksctl create cluster -f eks-cluster-config.yaml
  echo "  ✅ EKS Cluster created: $CLUSTER_NAME"
fi

# 5. AWS Load Balancer Controller 설치
echo ""
echo "Step 5: Installing AWS Load Balancer Controller..."

helm repo add eks https://aws.github.io/eks-charts
helm repo update

kubectl apply -k "github.com/aws/eks-charts/stable/aws-load-balancer-controller/crds?ref=master"

helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=$CLUSTER_NAME \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set region=$AWS_REGION \
  --set vpcId=$(aws eks describe-cluster --name $CLUSTER_NAME --region $AWS_REGION --query "cluster.resourcesVpcConfig.vpcId" --output text)

echo "✅ AWS Load Balancer Controller installed"

# 6. RDS PostgreSQL 생성
echo ""
echo "Step 6: Creating RDS PostgreSQL..."
echo "⚠️  This will take 10-15 minutes"

DB_INSTANCE_ID="fans-postgres"
DB_NAME="fans_db"
DB_USERNAME="fans_user"
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

# VPC 정보 가져오기
VPC_ID=$(aws eks describe-cluster --name $CLUSTER_NAME --region $AWS_REGION --query "cluster.resourcesVpcConfig.vpcId" --output text)
SUBNET_IDS=$(aws eks describe-cluster --name $CLUSTER_NAME --region $AWS_REGION --query "cluster.resourcesVpcConfig.subnetIds" --output text)

# DB 서브넷 그룹 생성
aws rds create-db-subnet-group \
  --db-subnet-group-name fans-db-subnet-group \
  --db-subnet-group-description "FANS DB Subnet Group" \
  --subnet-ids $SUBNET_IDS \
  --region $AWS_REGION 2>/dev/null || echo "  ℹ️  DB Subnet Group already exists"

# 보안 그룹 생성
SG_ID=$(aws ec2 create-security-group \
  --group-name fans-rds-sg \
  --description "FANS RDS Security Group" \
  --vpc-id $VPC_ID \
  --region $AWS_REGION \
  --query "GroupId" \
  --output text 2>/dev/null || \
  aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=fans-rds-sg" "Name=vpc-id,Values=$VPC_ID" \
    --region $AWS_REGION \
    --query "SecurityGroups[0].GroupId" \
    --output text)

# PostgreSQL 포트 오픈
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 5432 \
  --cidr 10.0.0.0/8 \
  --region $AWS_REGION 2>/dev/null || echo "  ℹ️  Ingress rule already exists"

# RDS 인스턴스 생성
if aws rds describe-db-instances --db-instance-identifier $DB_INSTANCE_ID --region $AWS_REGION >/dev/null 2>&1; then
  echo "  ℹ️  RDS instance already exists"
else
  aws rds create-db-instance \
    --db-instance-identifier $DB_INSTANCE_ID \
    --db-instance-class db.t3.medium \
    --engine postgres \
    --engine-version 15.4 \
    --master-username $DB_USERNAME \
    --master-user-password "$DB_PASSWORD" \
    --allocated-storage 100 \
    --storage-type gp3 \
    --db-subnet-group-name fans-db-subnet-group \
    --vpc-security-group-ids $SG_ID \
    --backup-retention-period 7 \
    --preferred-backup-window "03:00-04:00" \
    --preferred-maintenance-window "mon:04:00-mon:05:00" \
    --multi-az \
    --publicly-accessible false \
    --region $AWS_REGION

  echo "  ✅ RDS instance created: $DB_INSTANCE_ID"
fi

# 7. ElastiCache Redis 생성
echo ""
echo "Step 7: Creating ElastiCache Redis..."

REDIS_CLUSTER_ID="fans-redis"

# Redis 서브넷 그룹 생성
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name fans-redis-subnet-group \
  --cache-subnet-group-description "FANS Redis Subnet Group" \
  --subnet-ids $SUBNET_IDS \
  --region $AWS_REGION 2>/dev/null || echo "  ℹ️  Redis Subnet Group already exists"

# Redis 보안 그룹
REDIS_SG_ID=$(aws ec2 create-security-group \
  --group-name fans-redis-sg \
  --description "FANS Redis Security Group" \
  --vpc-id $VPC_ID \
  --region $AWS_REGION \
  --query "GroupId" \
  --output text 2>/dev/null || \
  aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=fans-redis-sg" "Name=vpc-id,Values=$VPC_ID" \
    --region $AWS_REGION \
    --query "SecurityGroups[0].GroupId" \
    --output text)

aws ec2 authorize-security-group-ingress \
  --group-id $REDIS_SG_ID \
  --protocol tcp \
  --port 6379 \
  --cidr 10.0.0.0/8 \
  --region $AWS_REGION 2>/dev/null || echo "  ℹ️  Redis ingress rule already exists"

# ElastiCache 생성
if aws elasticache describe-cache-clusters --cache-cluster-id $REDIS_CLUSTER_ID --region $AWS_REGION >/dev/null 2>&1; then
  echo "  ℹ️  Redis cluster already exists"
else
  aws elasticache create-cache-cluster \
    --cache-cluster-id $REDIS_CLUSTER_ID \
    --cache-node-type cache.t3.medium \
    --engine redis \
    --engine-version "7.0" \
    --num-cache-nodes 1 \
    --cache-subnet-group-name fans-redis-subnet-group \
    --security-group-ids $REDIS_SG_ID \
    --region $AWS_REGION

  echo "  ✅ Redis cluster created: $REDIS_CLUSTER_ID"
fi

echo ""
echo "=========================================="
echo "✅ Infrastructure Setup Complete!"
echo "=========================================="
echo ""
echo "📝 Save these credentials:"
echo "----------------------------------------"
echo "RDS Endpoint: (wait for creation, then run: aws rds describe-db-instances --db-instance-identifier $DB_INSTANCE_ID --query 'DBInstances[0].Endpoint.Address' --output text)"
echo "DB Username: $DB_USERNAME"
echo "DB Password: $DB_PASSWORD"
echo "Redis Endpoint: (wait for creation, then run: aws elasticache describe-cache-clusters --cache-cluster-id $REDIS_CLUSTER_ID --show-cache-node-info --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' --output text)"
echo "Certificate ARN: $CERT_ARN"
echo "Hosted Zone ID: $HOSTED_ZONE_ID"
echo "=========================================="
echo ""
echo "⏳ Next steps:"
echo "1. Wait for ACM certificate validation (check DNS records in Route 53)"
echo "2. Wait for RDS and Redis to finish creating (~15 min)"
echo "3. Run './build-and-push-images.sh' to push Docker images to ECR"
echo "4. Apply Kubernetes manifests with 'kubectl apply -k k8s/overlays/prod'"
