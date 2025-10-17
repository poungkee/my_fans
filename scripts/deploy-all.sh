#!/bin/bash
# ========================================
# FANS 전체 배포 스크립트
# ========================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 로그 함수
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ========================================
# 사전 체크
# ========================================

log_info "사전 요구사항 체크 중..."

# 필수 도구 확인
for cmd in terraform kubectl helm aws; do
    if ! command -v $cmd &> /dev/null; then
        log_error "$cmd 가 설치되지 않았습니다."
        exit 1
    fi
done

log_info "모든 필수 도구가 설치되어 있습니다."

# ========================================
# 1단계: Terraform 인프라 배포
# ========================================

log_info "========================================="
log_info "1단계: AWS 인프라 구축 (Terraform)"
log_info "========================================="

cd infra/terraform

# Terraform 초기화
log_info "Terraform 초기화 중..."
terraform init

# 플랜 확인
log_info "Terraform 플랜 생성 중..."
terraform plan -var-file="terraform-minimal.tfvars" -out=tfplan

# 승인 요청
read -p "위 플랜을 적용하시겠습니까? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    log_error "배포가 취소되었습니다."
    exit 1
fi

# 적용
log_info "Terraform 적용 중... (약 30분 소요)"
terraform apply tfplan

# Output 저장
log_info "인프라 정보 저장 중..."
RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
ECR_REGISTRY=$(terraform output -raw ecr_registry_url)
EKS_CLUSTER=$(terraform output -raw eks_cluster_name)

log_info "RDS 엔드포인트: $RDS_ENDPOINT"
log_info "ECR 레지스트리: $ECR_REGISTRY"
log_info "EKS 클러스터: $EKS_CLUSTER"

cd ../..

# ========================================
# 2단계: kubectl 설정
# ========================================

log_info "========================================="
log_info "2단계: kubectl 설정"
log_info "========================================="

aws eks update-kubeconfig --name $EKS_CLUSTER --region ap-northeast-2

# 노드 확인
log_info "EKS 노드 확인 중..."
kubectl get nodes

# ========================================
# 3단계: Karpenter 설치
# ========================================

log_info "========================================="
log_info "3단계: Karpenter 설치"
log_info "========================================="

# Karpenter Helm 리포지토리 추가
helm repo add karpenter https://charts.karpenter.sh
helm repo update

# Karpenter 설치
KARPENTER_ROLE_ARN=$(cd infra/terraform && terraform output -raw karpenter_role_arn)

helm upgrade --install karpenter karpenter/karpenter \
  --namespace karpenter --create-namespace \
  --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=$KARPENTER_ROLE_ARN \
  --set clusterName=$EKS_CLUSTER \
  --set clusterEndpoint=$(aws eks describe-cluster --name $EKS_CLUSTER --query "cluster.endpoint" --output text) \
  --set defaultInstanceProfile=dw-fans-prod-eks-karpenter-node-profile \
  --wait

log_info "Karpenter 설치 완료"

# Karpenter Provisioner 적용
kubectl apply -f infra/kubernetes/minimal/09-karpenter-provisioner.yaml

# ========================================
# 4단계: cert-manager 설치
# ========================================

log_info "========================================="
log_info "4단계: cert-manager 설치 (SSL)"
log_info "========================================="

# cert-manager 설치
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# cert-manager 준비 대기
log_info "cert-manager 준비 중..."
kubectl wait --for=condition=Available --timeout=300s deployment/cert-manager -n cert-manager
kubectl wait --for=condition=Available --timeout=300s deployment/cert-manager-webhook -n cert-manager

# ========================================
# 5단계: NGINX Ingress Controller 설치
# ========================================

log_info "========================================="
log_info "5단계: NGINX Ingress Controller 설치"
log_info "========================================="

helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace \
  --set controller.service.type=LoadBalancer \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/aws-load-balancer-type"="nlb" \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/aws-load-balancer-cross-zone-load-balancing-enabled"="true" \
  --wait

# NLB 주소 확인
log_info "NLB 주소 확인 중..."
NLB_ADDRESS=$(kubectl get svc ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
log_info "NLB 주소: $NLB_ADDRESS"

# ========================================
# 6단계: 모니터링 스택 설치
# ========================================

log_info "========================================="
log_info "6단계: 모니터링 스택 설치"
log_info "========================================="

# Prometheus + Grafana
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  -f infra/kubernetes/monitoring/prometheus-values.yaml \
  --wait

# Loki
helm repo add grafana https://grafana.github.io/helm-charts
helm upgrade --install loki grafana/loki-stack \
  --namespace monitoring \
  -f infra/kubernetes/monitoring/loki-values.yaml \
  --wait

log_info "모니터링 스택 설치 완료"

# ========================================
# 7단계: Secrets 설정
# ========================================

log_info "========================================="
log_info "7단계: Secrets 설정"
log_info "========================================="

log_warn "다음 정보를 입력해주세요:"

read -sp "PostgreSQL 비밀번호: " DB_PASSWORD
echo
read -p "JWT Secret: " JWT_SECRET
read -p "Naver Client ID: " NAVER_CLIENT_ID
read -sp "Naver Client Secret: " NAVER_CLIENT_SECRET
echo

# Secret 생성
kubectl create namespace fans --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic fans-secrets \
  --from-literal=POSTGRES_PASSWORD=$DB_PASSWORD \
  --from-literal=JWT_SECRET=$JWT_SECRET \
  --from-literal=NAVER_SEARCH_CLIENT_ID=$NAVER_CLIENT_ID \
  --from-literal=NAVER_SEARCH_CLIENT_SECRET=$NAVER_CLIENT_SECRET \
  --from-literal=SESSION_SECRET=$(openssl rand -base64 32) \
  -n fans \
  --dry-run=client -o yaml | kubectl apply -f -

log_info "Secrets 설정 완료"

# ========================================
# 8단계: ConfigMap 업데이트
# ========================================

log_info "========================================="
log_info "8단계: ConfigMap 업데이트"
log_info "========================================="

# RDS 엔드포인트를 ConfigMap에 반영
sed -i "s/REPLACE_WITH_RDS_ENDPOINT/$RDS_ENDPOINT/g" infra/kubernetes/minimal/01-configmap.yaml

kubectl apply -f infra/kubernetes/minimal/01-configmap.yaml

# ========================================
# 9단계: Docker 이미지 빌드 & 푸시
# ========================================

log_info "========================================="
log_info "9단계: Docker 이미지 빌드 & ECR 푸시"
log_info "========================================="

# ECR 로그인
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin $ECR_REGISTRY

# 이미지 빌드 함수
build_and_push() {
    local SERVICE=$1
    local DOCKERFILE=$2
    local CONTEXT=$3

    log_info "빌드 중: $SERVICE"
    docker build -t $ECR_REGISTRY/$SERVICE:latest -f $DOCKERFILE $CONTEXT
    docker push $ECR_REGISTRY/$SERVICE:latest
}

# 모든 서비스 빌드
build_and_push "fans-main-api" "backend/api/Dockerfile" "backend/api"
build_and_push "fans-frontend" "frontend/Dockerfile" "frontend"
build_and_push "fans-api-crawler" "backend/crawler/api-crawler/Dockerfile" "backend/crawler"
build_and_push "fans-classification-api" "backend/simple-classifier/Dockerfile" "backend/simple-classifier"
build_and_push "fans-summarize-ai" "backend/ai/summarize-ai/Dockerfile" "backend/ai/summarize-ai"
build_and_push "fans-bias-analysis-ai" "backend/ai/bias-analysis-ai/Dockerfile" "backend/ai/bias-analysis-ai"
build_and_push "fans-scheduler" "backend/scheduler/Dockerfile" "backend/scheduler"

log_info "모든 이미지 빌드 완료"

# ========================================
# 10단계: Kubernetes 리소스 배포
# ========================================

log_info "========================================="
log_info "10단계: Kubernetes 리소스 배포"
log_info "========================================="

# AWS_ACCOUNT_ID 치환
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
find infra/kubernetes/minimal -name "*.yaml" -exec sed -i "s/\${AWS_ACCOUNT_ID}/$AWS_ACCOUNT_ID/g" {} \;

# 순서대로 배포
kubectl apply -f infra/kubernetes/minimal/00-namespace.yaml
kubectl apply -f infra/kubernetes/minimal/01-configmap.yaml
kubectl apply -f infra/kubernetes/minimal/02-secrets.yaml
kubectl apply -f infra/kubernetes/minimal/03-redis-statefulset.yaml
kubectl apply -f infra/kubernetes/minimal/04-main-api.yaml
kubectl apply -f infra/kubernetes/minimal/05-frontend.yaml
kubectl apply -f infra/kubernetes/minimal/06-ai-services.yaml
kubectl apply -f infra/kubernetes/minimal/07-crawler-scheduler.yaml
kubectl apply -f infra/kubernetes/minimal/08-ingress.yaml

log_info "Kubernetes 리소스 배포 완료"

# Pod 상태 확인
log_info "Pod 상태 확인 중..."
kubectl get pods -n fans

# ========================================
# 11단계: Route 53 설정
# ========================================

log_info "========================================="
log_info "11단계: Route 53 DNS 설정"
log_info "========================================="

log_info "NLB 주소: $NLB_ADDRESS"
log_warn "Route 53에서 다음 레코드를 수동으로 생성하세요:"
echo "  fans.ai.kr -> $NLB_ADDRESS (CNAME)"
echo "  api.fans.ai.kr -> $NLB_ADDRESS (CNAME)"
echo "  ai.fans.ai.kr -> $NLB_ADDRESS (CNAME)"

# ========================================
# 완료
# ========================================

log_info "========================================="
log_info "배포 완료!"
log_info "========================================="

echo ""
log_info "접속 URL:"
echo "  Frontend: https://fans.ai.kr"
echo "  API: https://api.fans.ai.kr"
echo "  Grafana: https://grafana.fans.ai.kr"
echo ""
log_info "모니터링:"
echo "  kubectl get pods -n fans"
echo "  kubectl logs -f deployment/main-api -n fans"
echo ""
log_info "Grafana 접속:"
echo "  kubectl port-forward svc/monitoring-grafana 3000:80 -n monitoring"
echo "  http://localhost:3000 (admin / CHANGE_ME_PLEASE)"
