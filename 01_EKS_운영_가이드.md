# EKS 수동 실행 & 종료 가이드

**FANS 프로젝트 - AWS EKS 클러스터 운영 매뉴얼**

---

## 📋 목차

1. [사전 준비사항](#사전-준비사항)
2. [EKS 클러스터 생성 (실행)](#eks-클러스터-생성-실행)
3. [애플리케이션 배포](#애플리케이션-배포)
4. [클러스터 상태 확인](#클러스터-상태-확인)
5. [EKS 클러스터 종료 (삭제)](#eks-클러스터-종료-삭제)
6. [비용 관리](#비용-관리)
7. [트러블슈팅](#트러블슈팅)

---

## 사전 준비사항

### 필수 도구 설치 확인

```bash
# AWS CLI 버전 확인
aws --version
# 필요: AWS CLI 2.x 이상

# Terraform 버전 확인
terraform --version
# 필요: Terraform 1.0 이상

# kubectl 버전 확인
kubectl version --client
# 필요: kubectl 1.28 이상

# Docker 버전 확인
docker --version
# 필요: Docker 20.10 이상
```

### AWS 인증 설정

```bash
# AWS 자격 증명 구성
aws configure

# 입력 필요 정보:
# - AWS Access Key ID: [당신의 Access Key]
# - AWS Secret Access Key: [당신의 Secret Key]
# - Default region name: ap-northeast-2
# - Default output format: json

# 인증 확인
aws sts get-caller-identity
```

---

## EKS 클러스터 생성 (실행)

### 1단계: Terraform 변수 파일 준비

**파일 위치**: `D:\dev1\infra\terraform\secret.tfvars`

```hcl
# secret.tfvars 내용
aws_region = "ap-northeast-2"
project_name = "FANS"
environment = "production"

# RDS 데이터베이스 설정
db_username = "fans_admin"
db_password = "your-secure-password-here"  # 변경 필수!
db_name = "fans_db"
```

**⚠️ 주의**: `secret.tfvars` 파일은 절대 Git에 커밋하지 마세요!

### 2단계: Terraform 초기화

```bash
# Terraform 작업 디렉토리로 이동
cd D:/dev1/infra/terraform

# Terraform 초기화 (최초 1회만 실행)
terraform init

# 실행 결과:
# Terraform has been successfully initialized!
```

### 3단계: 인프라 계획 검토

```bash
# Terraform 실행 계획 확인
terraform plan -var-file="secret.tfvars"

# 생성될 리소스 확인:
# - aws_eks_cluster.main
# - aws_eks_node_group.main
# - aws_db_instance.main (RDS PostgreSQL)
# - aws_nat_gateway.main
# - aws_eip.nat
# - aws_route53_zone.main (선택사항)
# 등등...
```

### 4단계: EKS 클러스터 생성

```bash
# 인프라 생성 실행 (약 15-20분 소요)
terraform apply -var-file="secret.tfvars" -auto-approve

# 진행 상황:
# - VPC 및 서브넷 생성 (1분)
# - NAT Gateway 생성 (2분)
# - RDS PostgreSQL 생성 (5-7분)
# - EKS 클러스터 생성 (10-15분)
# - EKS 노드 그룹 생성 (3-5분)
```

**생성되는 주요 리소스:**

| 리소스 | 설명 | 예상 시간 |
|--------|------|----------|
| VPC | 가상 네트워크 | 1분 |
| Subnets | Public 2개, Private 2개 | 1분 |
| NAT Gateway | Private 서브넷 인터넷 연결 | 2분 |
| EKS Cluster | Kubernetes 클러스터 | 10-15분 |
| EKS Node Group | t3.large 인스턴스 1-2개 | 3-5분 |
| RDS PostgreSQL | db.t4g.micro 데이터베이스 | 5-7분 |

### 5단계: kubectl 설정

```bash
# EKS 클러스터에 연결하도록 kubectl 구성
aws eks update-kubeconfig --region ap-northeast-2 --name dw-FANS-EKS-Cluster

# 연결 확인
kubectl get nodes

# 예상 출력:
# NAME                                            STATUS   ROLES    AGE   VERSION
# ip-10-0-1-123.ap-northeast-2.compute.internal   Ready    <none>   5m    v1.28.x
```

---

## 애플리케이션 배포

### 1단계: Docker 이미지 빌드 및 ECR 푸시

```bash
# ECR 레지스트리 로그인
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin [YOUR_ACCOUNT_ID].dkr.ecr.ap-northeast-2.amazonaws.com

# 모든 서비스 이미지 빌드 (D:\dev1에서 실행)
cd D:/dev1

# Frontend
docker build -t fans/frontend:latest -f frontend/Dockerfile frontend/
docker tag fans/frontend:latest [YOUR_ACCOUNT_ID].dkr.ecr.ap-northeast-2.amazonaws.com/fans/frontend:latest
docker push [YOUR_ACCOUNT_ID].dkr.ecr.ap-northeast-2.amazonaws.com/fans/frontend:latest

# Main API
docker build -t fans/main-api:latest -f backend/fans_main_api/Dockerfile backend/fans_main_api/
docker tag fans/main-api:latest [YOUR_ACCOUNT_ID].dkr.ecr.ap-northeast-2.amazonaws.com/fans/main-api:latest
docker push [YOUR_ACCOUNT_ID].dkr.ecr.ap-northeast-2.amazonaws.com/fans/main-api:latest

# API Crawler
docker build -t fans/api-crawler:latest -f backend/fans_api_crawler/Dockerfile backend/fans_api_crawler/
docker tag fans/api-crawler:latest [YOUR_ACCOUNT_ID].dkr.ecr.ap-northeast-2.amazonaws.com/fans/api-crawler:latest
docker push [YOUR_ACCOUNT_ID].dkr.ecr.ap-northeast-2.amazonaws.com/fans/api-crawler:latest

# Scheduler
docker build -t fans/scheduler:latest -f backend/fans_scheduler/Dockerfile backend/fans_scheduler/
docker tag fans/scheduler:latest [YOUR_ACCOUNT_ID].dkr.ecr.ap-northeast-2.amazonaws.com/fans/scheduler:latest
docker push [YOUR_ACCOUNT_ID].dkr.ecr.ap-northeast-2.amazonaws.com/fans/scheduler:latest

# AI Services
docker build -t fans/summarize-ai:latest -f backend/ai/summarize-ai/Dockerfile backend/ai/summarize-ai/
docker tag fans/summarize-ai:latest [YOUR_ACCOUNT_ID].dkr.ecr.ap-northeast-2.amazonaws.com/fans/summarize-ai:latest
docker push [YOUR_ACCOUNT_ID].dkr.ecr.ap-northeast-2.amazonaws.com/fans/summarize-ai:latest

docker build -t fans/bias-analysis-ai:latest -f backend/ai/bias-analysis-ai/Dockerfile backend/ai/bias-analysis-ai/
docker tag fans/bias-analysis-ai:latest [YOUR_ACCOUNT_ID].dkr.ecr.ap-northeast-2.amazonaws.com/fans/bias-analysis-ai:latest
docker push [YOUR_ACCOUNT_ID].dkr.ecr.ap-northeast-2.amazonaws.com/fans/bias-analysis-ai:latest

docker build -t fans/classification-api:latest -f backend/simple-classifier/Dockerfile backend/simple-classifier/
docker tag fans/classification-api:latest [YOUR_ACCOUNT_ID].dkr.ecr.ap-northeast-2.amazonaws.com/fans/classification-api:latest
docker push [YOUR_ACCOUNT_ID].dkr.ecr.ap-northeast-2.amazonaws.com/fans/classification-api:latest
```

### 2단계: Kubernetes 시크릿 생성

```bash
# 데이터베이스 연결 정보 시크릿 생성
kubectl create secret generic db-secret \
  --from-literal=DB_HOST=fans-postgres.cz884ewuuhlv.ap-northeast-2.rds.amazonaws.com \
  --from-literal=DB_PORT=5432 \
  --from-literal=DB_NAME=fans_db \
  --from-literal=DB_USER=fans_admin \
  --from-literal=DB_PASSWORD=your-secure-password

# OpenAI API 키 시크릿 생성
kubectl create secret generic openai-secret \
  --from-literal=OPENAI_API_KEY=your-openai-api-key

# 시크릿 확인
kubectl get secrets
```

### 3단계: Kubernetes 리소스 배포

```bash
# Redis 배포
kubectl apply -f k8s/redis.yaml

# ConfigMap 배포
kubectl apply -f k8s/configmap.yaml

# 메인 API 배포
kubectl apply -f k8s/main-api.yaml

# AI 서비스 배포
kubectl apply -f k8s/ai-services.yaml

# 크롤러 배포
kubectl apply -f k8s/crawlers.yaml

# 프론트엔드 배포
kubectl apply -f k8s/frontend.yaml

# Ingress 배포 (로드밸런서)
kubectl apply -f k8s/ingress.yaml
```

### 4단계: 배포 확인

```bash
# 모든 Pod 상태 확인
kubectl get pods

# 예상 출력:
# NAME                                READY   STATUS    RESTARTS   AGE
# main-api-xxxxx                      1/1     Running   0          5m
# frontend-xxxxx                      1/1     Running   0          5m
# api-crawler-xxxxx                   1/1     Running   0          5m
# scheduler-xxxxx                     1/1     Running   0          5m
# summarize-ai-xxxxx                  1/1     Running   0          5m
# bias-analysis-ai-xxxxx              1/1     Running   0          5m
# classification-api-xxxxx            1/1     Running   0          5m
# redis-xxxxx                         1/1     Running   0          5m

# 서비스 확인
kubectl get services

# Ingress 확인 (로드밸런서 URL 확인)
kubectl get ingress
```

---

## 클러스터 상태 확인

### 노드 상태 확인

```bash
# 노드 목록 및 상태
kubectl get nodes -o wide

# 노드 상세 정보
kubectl describe node [NODE_NAME]

# 노드 리소스 사용량
kubectl top nodes
```

### Pod 상태 확인

```bash
# 모든 Pod 상태
kubectl get pods --all-namespaces

# 특정 Pod 로그 확인
kubectl logs [POD_NAME]

# Pod 로그 실시간 확인
kubectl logs -f [POD_NAME]

# Pod 상세 정보
kubectl describe pod [POD_NAME]
```

### 서비스 상태 확인

```bash
# 서비스 목록
kubectl get services

# 로드밸런서 외부 IP 확인
kubectl get ingress

# 서비스 엔드포인트 확인
kubectl get endpoints
```

### 리소스 사용량 확인

```bash
# Metrics Server 설치 (최초 1회)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Pod 리소스 사용량
kubectl top pods

# 노드 리소스 사용량
kubectl top nodes
```

---

## EKS 클러스터 종료 (삭제)

### ⚠️ 중요: 데이터 백업

```bash
# RDS 스냅샷 생성 (선택사항)
aws rds create-db-snapshot \
  --db-instance-identifier fans-postgres \
  --db-snapshot-identifier fans-postgres-manual-backup-$(date +%Y%m%d)
```

### 1단계: Kubernetes 리소스 삭제

```bash
# 모든 Kubernetes 리소스 삭제
kubectl delete -f k8s/ingress.yaml
kubectl delete -f k8s/frontend.yaml
kubectl delete -f k8s/crawlers.yaml
kubectl delete -f k8s/ai-services.yaml
kubectl delete -f k8s/main-api.yaml
kubectl delete -f k8s/redis.yaml
kubectl delete -f k8s/configmap.yaml

# 또는 한 번에 삭제
kubectl delete all --all

# 시크릿 삭제
kubectl delete secret db-secret openai-secret
```

### 2단계: Terraform으로 인프라 삭제

```bash
# Terraform 작업 디렉토리로 이동
cd D:/dev1/infra/terraform

# 삭제 계획 확인
terraform plan -destroy -var-file="secret.tfvars"

# 인프라 삭제 실행 (약 15-20분 소요)
terraform destroy -var-file="secret.tfvars" -auto-approve
```

**삭제 순서 및 소요 시간:**

| 리소스 | 삭제 시간 | 비고 |
|--------|----------|------|
| Kubernetes Pods/Services | 1-2분 | kubectl delete |
| EKS Node Group | 3-5분 | 인스턴스 종료 |
| EKS Cluster | 10-15분 | 클러스터 해체 |
| RDS PostgreSQL | 5-10분 | 최종 스냅샷 생성 |
| NAT Gateway | 1-2분 | - |
| VPC 관련 리소스 | 2-3분 | - |

### 3단계: 삭제 확인

```bash
# EKS 클러스터 삭제 확인
aws eks list-clusters --region ap-northeast-2

# RDS 인스턴스 삭제 확인
aws rds describe-db-instances --region ap-northeast-2

# Terraform 상태 확인
terraform show
```

---

## 비용 관리

### 시간당 비용 계산

| 리소스 | 타입 | 시간당 비용 | 월간 비용 (730시간) |
|--------|------|------------|-------------------|
| **EKS Cluster** | 관리형 | $0.10 | ~$73 |
| **EC2 Node** | t3.large | $0.104 | ~$76 |
| **RDS** | db.t4g.micro | $0.021 | ~$15 |
| **NAT Gateway** | - | $0.045 | ~$33 |
| **데이터 전송** | - | ~$0.005 | ~$4 |
| **EBS 스토리지** | gp3 20GB | ~$0.003 | ~$2 |
| **로드밸런서** | ALB | ~$0.025 | ~$18 |
| **Route53** | Hosted Zone | - | $0.50 |
| **합계** | - | **~$0.30/hour** | **~$220/month** |

### 비용 절감 팁

#### 1. Spot 인스턴스 사용 (70% 절감)

```hcl
# eks.tf에서 노드 그룹 수정
resource "aws_eks_node_group" "main" {
  capacity_type = "SPOT"  # ON_DEMAND에서 SPOT으로 변경
  instance_types = ["t3.large", "t3a.large"]  # 여러 타입 지정
}
```

#### 2. 개발 시간만 실행

```bash
# 아침에 실행
terraform apply -var-file="secret.tfvars" -auto-approve

# 저녁에 종료
terraform destroy -var-file="secret.tfvars" -auto-approve
```

**절감액**: 하루 8시간만 실행 시 월 $73 절감

#### 3. Single-AZ 사용

```hcl
# rds.tf에서 Multi-AZ 비활성화
resource "aws_db_instance" "main" {
  multi_az = false  # true에서 false로 변경
}
```

**절감액**: 월 $15 절감

#### 4. RDS 일시 중지 (개발 환경)

```bash
# RDS 중지
aws rds stop-db-instance --db-instance-identifier fans-postgres

# RDS 시작
aws rds start-db-instance --db-instance-identifier fans-postgres
```

**절감액**: 중지 기간 동안 시간당 $0.021 절감

### 실제 운영 시간 기준 비용 예시

**4시간 운영 시 (테스트/데모)**:
- 총 비용: $0.30 × 4 = **$1.20**

**8시간 운영 시 (개발 작업)**:
- 총 비용: $0.30 × 8 = **$2.40**

**월 40시간 운영 시 (주 10시간)**:
- 총 비용: $0.30 × 40 = **$12.00**

---

## 트러블슈팅

### 문제 1: Pod가 Pending 상태

**증상**:
```bash
kubectl get pods
# NAME            READY   STATUS    RESTARTS   AGE
# main-api-xxx    0/1     Pending   0          5m
```

**원인**: 노드 리소스 부족

**해결**:
```bash
# 노드 수 증가
kubectl scale deployment main-api --replicas=1

# 또는 노드 그룹 확장
aws eks update-nodegroup-config \
  --cluster-name dw-FANS-EKS-Cluster \
  --nodegroup-name dw-FANS-Node-Group \
  --scaling-config minSize=2,maxSize=3,desiredSize=2
```

### 문제 2: ImagePullBackOff 에러

**증상**:
```bash
kubectl get pods
# NAME            READY   STATUS             RESTARTS   AGE
# main-api-xxx    0/1     ImagePullBackOff   0          5m
```

**원인**: ECR 인증 실패 또는 이미지 없음

**해결**:
```bash
# ECR 로그인 확인
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin [ACCOUNT_ID].dkr.ecr.ap-northeast-2.amazonaws.com

# 이미지 존재 확인
aws ecr describe-images --repository-name fans/main-api --region ap-northeast-2

# Pod 재시작
kubectl delete pod [POD_NAME]
```

### 문제 3: 데이터베이스 연결 실패

**증상**:
```bash
kubectl logs main-api-xxx
# Error: getaddrinfo ENOTFOUND fans-postgres.xxx.rds.amazonaws.com
```

**원인**: RDS 엔드포인트 잘못 설정

**해결**:
```bash
# RDS 엔드포인트 확인
aws rds describe-db-instances --db-instance-identifier fans-postgres --query 'DBInstances[0].Endpoint.Address'

# 시크릿 업데이트
kubectl delete secret db-secret
kubectl create secret generic db-secret \
  --from-literal=DB_HOST=[올바른 RDS 엔드포인트] \
  --from-literal=DB_PORT=5432 \
  --from-literal=DB_NAME=fans_db \
  --from-literal=DB_USER=fans_admin \
  --from-literal=DB_PASSWORD=your-password

# Pod 재시작
kubectl rollout restart deployment main-api
```

### 문제 4: LoadBalancer 외부 IP 할당 안됨

**증상**:
```bash
kubectl get ingress
# ADDRESS   PORTS   AGE
# <pending>  80      10m
```

**원인**: AWS Load Balancer Controller 미설치

**해결**:
```bash
# AWS Load Balancer Controller 설치
kubectl apply -f k8s/aws-load-balancer-controller.yaml

# 확인
kubectl get pods -n kube-system | grep aws-load-balancer
```

### 문제 5: Terraform destroy 실패

**증상**:
```bash
Error: deleting EC2 Internet Gateway: has dependencies
```

**원인**: Kubernetes가 생성한 LoadBalancer가 남아있음

**해결**:
```bash
# 먼저 모든 Kubernetes 서비스 삭제
kubectl delete all --all

# 10분 대기 후 다시 destroy
terraform destroy -var-file="secret.tfvars" -auto-approve
```

---

## 빠른 참조 명령어

### 클러스터 시작
```bash
cd D:/dev1/infra/terraform
terraform apply -var-file="secret.tfvars" -auto-approve
aws eks update-kubeconfig --region ap-northeast-2 --name dw-FANS-EKS-Cluster
```

### 애플리케이션 배포
```bash
kubectl apply -f k8s/
```

### 상태 확인
```bash
kubectl get pods
kubectl get services
kubectl get ingress
```

### 클러스터 종료
```bash
kubectl delete all --all
cd D:/dev1/infra/terraform
terraform destroy -var-file="secret.tfvars" -auto-approve
```

### 로그 확인
```bash
kubectl logs -f [POD_NAME]
```

---

**작성일**: 2025-10-21
**프로젝트**: FANS (Financial & Analytics News Service)
**버전**: 1.0
