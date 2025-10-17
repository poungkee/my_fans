# 🚀 FANS 최저비용 EKS 배포 가이드

**월 예상 비용: $137**

---

## 📋 목차

1. [사전 준비](#사전-준비)
2. [빠른 시작](#빠른-시작)
3. [단계별 상세 가이드](#단계별-상세-가이드)
4. [트러블슈팅](#트러블슈팅)
5. [비용 최적화 팁](#비용-최적화-팁)

---

## 사전 준비

### 필수 도구 설치

```bash
# AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# kubectl
curl -LO "https://dl.k8s.io/release/v1.28.0/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# terraform
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
```

### AWS 자격증명 설정

```bash
aws configure
# AWS Access Key ID: YOUR_KEY
# AWS Secret Access Key: YOUR_SECRET
# Default region: ap-northeast-2
# Default output format: json
```

### GitHub Secrets 설정

Repository Settings → Secrets → Actions에 다음을 추가:

```
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_ACCOUNT_ID=your_account_id
SLACK_WEBHOOK_URL=your_slack_webhook  (선택)
```

---

## 빠른 시작

### 자동 배포 (권장)

```bash
# 전체 자동 배포
bash scripts/deploy-all.sh
```

### 수동 배포

```bash
# 1. Terraform 인프라 구축 (30분)
cd infra/terraform
terraform init
terraform apply -var-file="terraform-minimal.tfvars"

# 2. kubectl 설정
aws eks update-kubeconfig --name dw-fans-prod-eks --region ap-northeast-2

# 3. Docker 이미지 빌드 & 푸시 (20분)
./scripts/build-and-push-all.sh

# 4. Kubernetes 배포 (10분)
kubectl apply -f infra/kubernetes/minimal/

# 5. 모니터링 설치 (5분)
helm install monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace \
  -f infra/kubernetes/monitoring/prometheus-values.yaml
```

---

## 단계별 상세 가이드

### 1단계: Terraform 인프라 구축

#### 1.1 변수 파일 편집

`infra/terraform/terraform-minimal.tfvars` 파일을 확인:

```hcl
# 기존 VPC 사용
existing_vpc_id = "vpc-0fa60f4833b7932ad"

# Spot Instance 설정 (70% 할인)
node_capacity_type = "SPOT"
node_instance_types = ["t3.medium", "t3a.medium", "t2.medium"]
node_desired_size = 2

# RDS 최소 사양
db_instance_class = "db.t4g.micro"
db_allocated_storage = 20
db_multi_az = false  # Single-AZ (비용 절감)
```

#### 1.2 Terraform 실행

```bash
cd infra/terraform

# 초기화
terraform init

# 플랜 확인
terraform plan -var-file="terraform-minimal.tfvars" -out=tfplan

# 적용 (DB 비밀번호 입력 필요)
terraform apply tfplan \
  -var="db_password=YOUR_STRONG_PASSWORD"

# 결과 확인
terraform output
```

#### 1.3 생성되는 리소스

```
✅ EKS 클러스터 (dw-fans-prod-eks)
✅ Spot Instance 노드 2대 (t3.medium)
✅ RDS PostgreSQL (db.t4g.micro, Single-AZ)
✅ Security Groups
✅ ECR 리포지토리 7개
✅ IAM Roles & Policies
✅ Karpenter IAM 설정
```

**소요 시간**: 약 30분

---

### 2단계: Karpenter 설치 (자동 스케일링)

```bash
# Karpenter Helm 리포지토리 추가
helm repo add karpenter https://charts.karpenter.sh
helm repo update

# Karpenter 설치
KARPENTER_ROLE_ARN=$(cd infra/terraform && terraform output -raw karpenter_role_arn)
EKS_CLUSTER=$(cd infra/terraform && terraform output -raw eks_cluster_name)

helm upgrade --install karpenter karpenter/karpenter \
  --namespace karpenter --create-namespace \
  --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=$KARPENTER_ROLE_ARN \
  --set clusterName=$EKS_CLUSTER \
  --set clusterEndpoint=$(aws eks describe-cluster --name $EKS_CLUSTER --query "cluster.endpoint" --output text) \
  --set defaultInstanceProfile=dw-fans-prod-eks-karpenter-node-profile \
  --wait

# Karpenter Provisioner 적용
kubectl apply -f infra/kubernetes/minimal/09-karpenter-provisioner.yaml
```

**Karpenter가 하는 일:**
- Pod가 Pending 상태면 **30초 내** 새 노드 추가
- 자동으로 **최저가 Spot Instance** 선택
- 사용률 낮으면 노드 자동 축소

---

### 3단계: NGINX Ingress & cert-manager

#### 3.1 cert-manager 설치 (무료 SSL)

```bash
# cert-manager 설치
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# 준비 대기
kubectl wait --for=condition=Available --timeout=300s deployment/cert-manager -n cert-manager
```

#### 3.2 NGINX Ingress Controller 설치

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace \
  --set controller.service.type=LoadBalancer \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/aws-load-balancer-type"="nlb" \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/aws-load-balancer-cross-zone-load-balancing-enabled"="true" \
  --wait

# NLB 주소 확인
kubectl get svc ingress-nginx-controller -n ingress-nginx
```

---

### 4단계: Secrets 설정

```bash
# Namespace 생성
kubectl create namespace fans

# Secrets 생성
kubectl create secret generic fans-secrets \
  --from-literal=POSTGRES_PASSWORD=your_db_password \
  --from-literal=JWT_SECRET=$(openssl rand -base64 32) \
  --from-literal=NAVER_SEARCH_CLIENT_ID=your_naver_id \
  --from-literal=NAVER_SEARCH_CLIENT_SECRET=your_naver_secret \
  --from-literal=NAVER_CLIENT_ID_2=your_naver_id_2 \
  --from-literal=NAVER_CLIENT_SECRET_2=your_naver_secret_2 \
  --from-literal=HUGGING_FACE_API_KEY=your_hf_key \
  --from-literal=SESSION_SECRET=$(openssl rand -base64 32) \
  -n fans
```

---

### 5단계: ConfigMap 업데이트

```bash
# RDS 엔드포인트 확인
RDS_ENDPOINT=$(cd infra/terraform && terraform output -raw rds_endpoint)

# ConfigMap 업데이트
sed -i "s/REPLACE_WITH_RDS_ENDPOINT/$RDS_ENDPOINT/g" \
  infra/kubernetes/minimal/01-configmap.yaml

# 적용
kubectl apply -f infra/kubernetes/minimal/01-configmap.yaml
```

---

### 6단계: Docker 이미지 빌드 & ECR 푸시

#### 6.1 ECR 로그인

```bash
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY=$AWS_ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com

aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin $ECR_REGISTRY
```

#### 6.2 이미지 빌드 & 푸시

```bash
# Main API
docker build -t $ECR_REGISTRY/fans-main-api:latest \
  -f backend/api/Dockerfile backend/api
docker push $ECR_REGISTRY/fans-main-api:latest

# Frontend
docker build -t $ECR_REGISTRY/fans-frontend:latest \
  --build-arg REACT_APP_API_URL=https://api.fans.ai.kr \
  -f frontend/Dockerfile frontend
docker push $ECR_REGISTRY/fans-frontend:latest

# AI Crawler
docker build -t $ECR_REGISTRY/fans-api-crawler:latest \
  -f backend/crawler/api-crawler/Dockerfile backend/crawler
docker push $ECR_REGISTRY/fans-api-crawler:latest

# Classification API
docker build -t $ECR_REGISTRY/fans-classification-api:latest \
  -f backend/simple-classifier/Dockerfile backend/simple-classifier
docker push $ECR_REGISTRY/fans-classification-api:latest

# Summarize AI
docker build -t $ECR_REGISTRY/fans-summarize-ai:latest \
  -f backend/ai/summarize-ai/Dockerfile backend/ai/summarize-ai
docker push $ECR_REGISTRY/fans-summarize-ai:latest

# Bias Analysis AI
docker build -t $ECR_REGISTRY/fans-bias-analysis-ai:latest \
  -f backend/ai/bias-analysis-ai/Dockerfile backend/ai/bias-analysis-ai
docker push $ECR_REGISTRY/fans-bias-analysis-ai:latest

# Scheduler
docker build -t $ECR_REGISTRY/fans-scheduler:latest \
  -f backend/scheduler/Dockerfile backend/scheduler
docker push $ECR_REGISTRY/fans-scheduler:latest
```

**소요 시간**: 약 20분

---

### 7단계: Kubernetes 리소스 배포

#### 7.1 AWS Account ID 치환

```bash
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

find infra/kubernetes/minimal -name "*.yaml" -exec \
  sed -i "s/\${AWS_ACCOUNT_ID}/$AWS_ACCOUNT_ID/g" {} \;
```

#### 7.2 리소스 배포

```bash
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

# Pod 상태 확인
kubectl get pods -n fans

# 모든 Pod이 Running 상태가 될 때까지 대기
kubectl wait --for=condition=Ready pods --all -n fans --timeout=10m
```

---

### 8단계: 모니터링 스택 설치

#### 8.1 Prometheus + Grafana

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  -f infra/kubernetes/monitoring/prometheus-values.yaml \
  --wait
```

#### 8.2 Loki (로그 수집)

```bash
helm repo add grafana https://grafana.github.io/helm-charts

helm upgrade --install loki grafana/loki-stack \
  --namespace monitoring \
  -f infra/kubernetes/monitoring/loki-values.yaml \
  --wait
```

#### 8.3 Grafana 접속

```bash
# 포트 포워딩
kubectl port-forward svc/monitoring-grafana 3000:80 -n monitoring

# 브라우저에서 접속
# http://localhost:3000
# ID: admin
# PW: CHANGE_ME_PLEASE (prometheus-values.yaml에서 설정한 비밀번호)
```

---

### 9단계: Route 53 DNS 설정

#### 9.1 NLB 주소 확인

```bash
NLB_ADDRESS=$(kubectl get svc ingress-nginx-controller -n ingress-nginx \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

echo "NLB 주소: $NLB_ADDRESS"
```

#### 9.2 Route 53 레코드 생성

AWS Console → Route 53 → Hosted Zones → fans.ai.kr

다음 CNAME 레코드 추가:

```
fans.ai.kr        CNAME  $NLB_ADDRESS
api.fans.ai.kr    CNAME  $NLB_ADDRESS
ai.fans.ai.kr     CNAME  $NLB_ADDRESS
grafana.fans.ai.kr CNAME $NLB_ADDRESS
```

또는 CLI로:

```bash
# Route 53 Zone ID 확인
ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name "fans.ai.kr" \
  --query "HostedZones[0].Id" \
  --output text | sed 's|/hostedzone/||')

# CNAME 레코드 생성
aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"UPSERT\",
      \"ResourceRecordSet\": {
        \"Name\": \"fans.ai.kr\",
        \"Type\": \"CNAME\",
        \"TTL\": 300,
        \"ResourceRecords\": [{\"Value\": \"$NLB_ADDRESS\"}]
      }
    }]
  }"
```

---

### 10단계: 배포 확인

```bash
# Pod 상태
kubectl get pods -n fans

# Service 상태
kubectl get svc -n fans

# Ingress 상태
kubectl get ingress -n fans

# 로그 확인
kubectl logs -f deployment/main-api -n fans

# 접속 테스트
curl -I https://fans.ai.kr
curl https://api.fans.ai.kr/health
```

---

## 트러블슈팅

### 1. Spot Instance가 중단됨

**문제**: Spot 인스턴스가 갑자기 종료되어 Pod이 Pending 상태

**해결**:
```bash
# Karpenter가 자동으로 새 노드 추가 (30초~1분)
# Pod 상태 확인
kubectl get pods -n fans

# 노드 상태 확인
kubectl get nodes

# 수동으로 노드 추가 (필요시)
kubectl scale deployment/main-api --replicas=3 -n fans
```

### 2. Pod이 ImagePullBackOff

**문제**: ECR에서 이미지를 가져올 수 없음

**해결**:
```bash
# ECR 권한 확인
aws ecr describe-repositories --region ap-northeast-2

# 노드의 IAM 역할 확인
kubectl describe node | grep ProviderID

# ECR 로그인 재시도
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin $ECR_REGISTRY

# 이미지 재빌드 & 푸시
docker push $ECR_REGISTRY/fans-main-api:latest
```

### 3. RDS 연결 실패

**문제**: Pod에서 PostgreSQL 접속 불가

**해결**:
```bash
# 1. Security Group 확인
# EKS 노드 SG → RDS SG (5432 포트) 허용 확인

# 2. RDS 엔드포인트 확인
cd infra/terraform && terraform output rds_endpoint

# 3. Secret 확인
kubectl get secret fans-secrets -n fans -o yaml

# 4. 연결 테스트
kubectl run -it --rm debug --image=postgres:15 --restart=Never -n fans -- \
  psql -h YOUR_RDS_ENDPOINT -U fans_admin -d fans_db
```

### 4. 도메인이 연결되지 않음

**문제**: fans.ai.kr 접속 불가

**해결**:
```bash
# 1. NLB 상태 확인
kubectl get svc ingress-nginx-controller -n ingress-nginx

# 2. Ingress 확인
kubectl describe ingress fans-ingress -n fans

# 3. DNS 전파 확인
nslookup fans.ai.kr

# 4. cert-manager 로그 확인
kubectl logs -n cert-manager deployment/cert-manager
```

### 5. Grafana 접속 불가

**문제**: Grafana 대시보드 접속 안됨

**해결**:
```bash
# 1. Grafana Pod 확인
kubectl get pods -n monitoring | grep grafana

# 2. 비밀번호 확인
kubectl get secret monitoring-grafana -n monitoring -o jsonpath="{.data.admin-password}" | base64 --decode

# 3. 포트 포워딩 재시도
kubectl port-forward svc/monitoring-grafana 3000:80 -n monitoring
```

---

## 비용 최적화 팁

### 1. Reserved Instance로 전환 (장기 운영 시)

```bash
# 1년 예약: 40% 할인
# 월 $137 → $82

# AWS Console → EC2 → Reserved Instances → Purchase
```

### 2. Spot Instance 활용 극대화

```yaml
# karpenter-provisioner.yaml에서 설정
requirements:
  - key: karpenter.sh/capacity-type
    operator: In
    values: ["spot"]  # spot만 사용 (더 저렴)
```

### 3. 불필요한 Pod 축소

```bash
# AI 서비스 replica 줄이기 (트래픽 적을 때)
kubectl scale deployment/summarize-ai --replicas=1 -n fans
kubectl scale deployment/bias-analysis-ai --replicas=0 -n fans  # 사용 안하면 0
```

### 4. 모니터링 보관 기간 단축

```yaml
# prometheus-values.yaml
retention: 3d  # 7일 → 3일
retentionSize: "5GB"  # 10GB → 5GB
```

### 5. ECR 이미지 정리

```bash
# 오래된 이미지 삭제 (자동)
# ecr-minimal.tf에서 설정:
ecr_image_retention_count = 5  # 최근 5개만 보관
```

---

## 비용 분석 대시보드

Grafana에서 비용 추적:

```bash
# Grafana 대시보드 Import
# Dashboard ID: 16237 (AWS Cost Explorer)
```

---

## CI/CD 사용법

### GitHub Push 시 자동 배포

```bash
# 1. 코드 수정
git add .
git commit -m "Update main-api"
git push origin main

# 2. GitHub Actions 자동 실행
# - Docker 이미지 빌드
# - ECR 푸시
# - Kubernetes 배포

# 3. 배포 확인
kubectl rollout status deployment/main-api -n fans
```

### 수동 배포

```bash
# 특정 서비스만 재배포
kubectl set image deployment/main-api \
  main-api=$ECR_REGISTRY/fans-main-api:latest \
  -n fans

kubectl rollout restart deployment/main-api -n fans
```

---

## 유지보수

### 로그 확인

```bash
# 실시간 로그
kubectl logs -f deployment/main-api -n fans

# 에러 로그만
kubectl logs deployment/main-api -n fans | grep ERROR

# 여러 Pod 로그
kubectl logs -l app=main-api -n fans --tail=100
```

### 리소스 모니터링

```bash
# Pod 리소스 사용량
kubectl top pods -n fans

# 노드 리소스 사용량
kubectl top nodes

# HPA 상태
kubectl get hpa -n fans
```

### 백업

```bash
# RDS 자동 백업 (7일 보관)
# 수동 스냅샷
aws rds create-db-snapshot \
  --db-instance-identifier fans-postgres \
  --db-snapshot-identifier fans-manual-$(date +%Y%m%d)

# Kubernetes 리소스 백업
kubectl get all -n fans -o yaml > backup-$(date +%Y%m%d).yaml
```

---

## 삭제 (정리)

```bash
# 1. Kubernetes 리소스 삭제
kubectl delete namespace fans
kubectl delete namespace monitoring
kubectl delete namespace ingress-nginx
kubectl delete namespace karpenter

# 2. Terraform 인프라 삭제
cd infra/terraform
terraform destroy -var-file="terraform-minimal.tfvars"

# 3. ECR 이미지 삭제
for repo in fans-main-api fans-frontend fans-api-crawler fans-classification-api fans-summarize-ai fans-bias-analysis-ai fans-scheduler; do
  aws ecr delete-repository --repository-name $repo --force --region ap-northeast-2
done
```

---

## 지원

문제가 발생하면:

1. **로그 확인**: `kubectl logs -f deployment/main-api -n fans`
2. **이벤트 확인**: `kubectl get events -n fans --sort-by='.lastTimestamp'`
3. **Pod 상태**: `kubectl describe pod <pod-name> -n fans`
4. **GitHub Issues**: [프로젝트 저장소]/issues

---

**작성일**: 2025-01-15
**버전**: 1.0
**작성자**: Claude AI Assistant
