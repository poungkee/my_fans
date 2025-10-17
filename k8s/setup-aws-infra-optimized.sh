#!/bin/bash
# AWS EKS 인프라 설정 스크립트 (비용 최적화 버전)
# 예상 비용: $150-200/월 (기존 $443에서 50% 절감)

set -e

# 변수 설정
export AWS_REGION="ap-northeast-2"
export CLUSTER_NAME="fans-eks-cluster"
export DOMAIN="fans.ai.kr"
export ECR_REPOSITORY_PREFIX="fans"

echo "=========================================="
echo "FANS EKS Infrastructure Setup (Optimized)"
echo "=========================================="
echo "Region: $AWS_REGION"
echo "Cluster: $CLUSTER_NAME"
echo "Domain: $DOMAIN"
echo "Estimated Cost: \$150-200/month"
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

# 4. EKS 클러스터 생성 (Fargate 사용으로 노드 비용 절감)
echo ""
echo "Step 4: Creating EKS Cluster with Fargate..."
echo "⚠️  This will take 15-20 minutes"

cat > eks-cluster-config-optimized.yaml <<EOF
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: $CLUSTER_NAME
  region: $AWS_REGION
  version: "1.28"

# Fargate 프로필 (서버리스, 노드 관리 불필요)
fargateProfiles:
  # 일반 워크로드용
  - name: fans-general
    selectors:
      - namespace: fans
        labels:
          workload: general
    subnets:
      - private-subnet-1
      - private-subnet-2

  # AI 워크로드용 (필요시에만 활성화)
  # AI 서비스는 비용이 크므로 Spot Instances 사용 권장
  # - name: fans-ai
  #   selectors:
  #     - namespace: fans
  #       labels:
  #         workload: ai

# Spot Instances 노드그룹 (70% 비용 절감)
managedNodeGroups:
  # 일반 워크로드용 (Spot Instances)
  - name: fans-spot-general
    instanceTypes:
      - t3a.small      # t3.medium 대신 t3a.small (더 저렴)
      - t3a.medium
    spot: true
    desiredCapacity: 2
    minSize: 1
    maxSize: 4
    volumeSize: 20     # 30GB 대신 20GB
    labels:
      role: worker
      cost: spot
    tags:
      Environment: production
      Project: FANS
      CostCenter: optimized

  # AI 워크로드용 (Spot Instances)
  - name: fans-spot-ai
    instanceTypes:
      - t3a.medium     # t3.large 대신 t3a.medium
      - t3a.large
    spot: true
    desiredCapacity: 1
    minSize: 0         # 사용 안할 때 0으로 줄일 수 있음
    maxSize: 2
    volumeSize: 30
    labels:
      role: ai-worker
      workload: ai
      cost: spot
    tags:
      Environment: production
      Project: FANS
      CostCenter: ai-optimized

iam:
  withOIDC: true
  serviceAccounts:
    - metadata:
        name: aws-load-balancer-controller
        namespace: kube-system
      wellKnownPolicies:
        awsLoadBalancerController: true

# CloudWatch 로그 비활성화 (로그는 Loki로 대체)
cloudWatch:
  clusterLogging:
    enableTypes: []
EOF

if eksctl get cluster --name "$CLUSTER_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
  echo "  ℹ️  Cluster already exists: $CLUSTER_NAME"
else
  eksctl create cluster -f eks-cluster-config-optimized.yaml
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

# 6. RDS PostgreSQL 생성 (Single-AZ, 비용 절감)
echo ""
echo "Step 6: Creating RDS PostgreSQL (Single-AZ)..."
echo "⚠️  This will take 10-15 minutes"

DB_INSTANCE_ID="fans-postgres"
DB_NAME="fans_db"
DB_USERNAME="fans_user"
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

VPC_ID=$(aws eks describe-cluster --name $CLUSTER_NAME --region $AWS_REGION --query "cluster.resourcesVpcConfig.vpcId" --output text)
SUBNET_IDS=$(aws eks describe-cluster --name $CLUSTER_NAME --region $AWS_REGION --query "cluster.resourcesVpcConfig.subnetIds" --output text)

aws rds create-db-subnet-group \
  --db-subnet-group-name fans-db-subnet-group \
  --db-subnet-group-description "FANS DB Subnet Group" \
  --subnet-ids $SUBNET_IDS \
  --region $AWS_REGION 2>/dev/null || echo "  ℹ️  DB Subnet Group already exists"

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

aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 5432 \
  --cidr 10.0.0.0/8 \
  --region $AWS_REGION 2>/dev/null || echo "  ℹ️  Ingress rule already exists"

if aws rds describe-db-instances --db-instance-identifier $DB_INSTANCE_ID --region $AWS_REGION >/dev/null 2>&1; then
  echo "  ℹ️  RDS instance already exists"
else
  aws rds create-db-instance \
    --db-instance-identifier $DB_INSTANCE_ID \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 15.4 \
    --master-username $DB_USERNAME \
    --master-user-password "$DB_PASSWORD" \
    --allocated-storage 20 \
    --storage-type gp3 \
    --db-subnet-group-name fans-db-subnet-group \
    --vpc-security-group-ids $SG_ID \
    --backup-retention-period 7 \
    --preferred-backup-window "03:00-04:00" \
    --preferred-maintenance-window "mon:04:00-mon:05:00" \
    --no-multi-az \
    --publicly-accessible false \
    --region $AWS_REGION

  echo "  ✅ RDS instance created: $DB_INSTANCE_ID (db.t3.micro, Single-AZ)"
fi

# 7. ElastiCache Redis 생성 (cache.t3.micro)
echo ""
echo "Step 7: Creating ElastiCache Redis (t3.micro)..."

REDIS_CLUSTER_ID="fans-redis"

aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name fans-redis-subnet-group \
  --cache-subnet-group-description "FANS Redis Subnet Group" \
  --subnet-ids $SUBNET_IDS \
  --region $AWS_REGION 2>/dev/null || echo "  ℹ️  Redis Subnet Group already exists"

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

if aws elasticache describe-cache-clusters --cache-cluster-id $REDIS_CLUSTER_ID --region $AWS_REGION >/dev/null 2>&1; then
  echo "  ℹ️  Redis cluster already exists"
else
  aws elasticache create-cache-cluster \
    --cache-cluster-id $REDIS_CLUSTER_ID \
    --cache-node-type cache.t3.micro \
    --engine redis \
    --engine-version "7.0" \
    --num-cache-nodes 1 \
    --cache-subnet-group-name fans-redis-subnet-group \
    --security-group-ids $REDIS_SG_ID \
    --region $AWS_REGION

  echo "  ✅ Redis cluster created: $REDIS_CLUSTER_ID (cache.t3.micro)"
fi

echo ""
echo "=========================================="
echo "✅ Optimized Infrastructure Setup Complete!"
echo "=========================================="
echo ""
echo "💰 Cost Breakdown (Monthly):"
echo "----------------------------------------"
echo "EKS Cluster:              \$73"
echo "EC2 Spot Instances (3x):  ~\$30  (70% 할인)"
echo "RDS db.t3.micro (Single): ~\$15  (기존 \$100)"
echo "ElastiCache t3.micro:     ~\$12  (기존 \$50)"
echo "ALB:                      ~\$20"
echo "Data Transfer:            ~\$30"
echo "----------------------------------------"
echo "Total:                    ~\$180/month"
echo "Savings:                  \$263/month (59% OFF!)"
echo "=========================================="
echo ""
echo "📝 Saved credentials:"
echo "DB Username: $DB_USERNAME"
echo "DB Password: $DB_PASSWORD"
echo ""
echo "⏳ Next: Run './deploy-monitoring.sh' to setup monitoring"
