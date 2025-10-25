# EKS 운영 환경 (Kubernetes)

## 📂 디렉토리 구조

```
environments/eks/
├── manifests/          # Kubernetes 매니페스트 (k8s/)
│   ├── 00-storageclass.yaml
│   ├── 01-namespace.yaml
│   ├── 06-main-api.yaml
│   └── 10-ingress.yaml
├── terraform/          # Terraform IaC (infra/terraform-eks/)
│   ├── main.tf
│   ├── eks.tf
│   └── vpc.tf
├── scripts/            # 배포 스크립트
│   ├── deploy-manifests.sh
│   └── scale-nodegroup.sh
└── README.md
```

## 🚀 EKS 클러스터 정보

- **클러스터 이름**: fans-cluster-2az
- **리전**: ap-northeast-2 (서울)
- **Kubernetes 버전**: 1.31
- **노드**: 4개 (t3.medium × 2, t3.large × 2)

## 📦 배포된 서비스

### Namespace: fans
- main-api (2 replicas)
- summarize-ai (2 replicas)
- bias-analysis-ai (2 replicas)
- classification-api (2 replicas)
- unified-crawler (1 replica)
- scheduler (1 replica)
- redis (1 replica)

### Namespace: monitoring
- Prometheus
- Grafana
- Alertmanager
- Node Exporter (4개)

## 🔧 주요 명령어

### 클러스터 접속
```bash
aws eks update-kubeconfig \
  --name fans-cluster-2az \
  --region ap-northeast-2
```

### Kubernetes 매니페스트 배포
```bash
cd environments/eks/scripts
./deploy-manifests.sh
```

### NodeGroup 스케일 조정
```bash
# 비용 절감 (축소)
./scale-nodegroup.sh stop

# 재시작
./scale-nodegroup.sh start
```

### Terraform으로 인프라 구축
```bash
cd environments/eks/terraform

# 초기화
terraform init

# 계획 확인
terraform plan

# 인프라 생성
terraform apply
```

### Pod 상태 확인
```bash
kubectl get pods -n fans
kubectl get pods -n monitoring
```

### 서비스 확인
```bash
kubectl get svc -n fans
kubectl get ingress -n fans
```

### 로그 확인
```bash
kubectl logs -f deployment/main-api -n fans
kubectl logs -f deployment/summarize-ai -n fans
```

## 💰 비용 절감

### NodeGroup 축소 (종료)
```bash
aws eks update-nodegroup-config \
  --cluster-name fans-cluster-2az \
  --nodegroup-name fans-private-medium-2az \
  --scaling-config minSize=0,maxSize=2,desiredSize=0

aws eks update-nodegroup-config \
  --cluster-name fans-cluster-2az \
  --nodegroup-name fans-private-large-2az \
  --scaling-config minSize=0,maxSize=2,desiredSize=0
```

### NodeGroup 재시작
```bash
aws eks update-nodegroup-config \
  --cluster-name fans-cluster-2az \
  --nodegroup-name fans-private-medium-2az \
  --scaling-config minSize=2,maxSize=4,desiredSize=2

aws eks update-nodegroup-config \
  --cluster-name fans-cluster-2az \
  --nodegroup-name fans-private-large-2az \
  --scaling-config minSize=2,maxSize=4,desiredSize=2
```

## 🌐 접속 주소

- **Frontend**: https://www.fans.ai.kr (CloudFront + S3)
- **API**: https://api.fans.ai.kr (ALB → main-api)
- **Grafana**: https://monitoring.fans.ai.kr

## 📊 모니터링

### Grafana 접속 정보
- URL: https://monitoring.fans.ai.kr
- Username: `admin`
- Password: `FansAdmin2025!`

## 📝 Kubernetes 매니페스트

매니페스트 파일 위치: `../../k8s/`

```
k8s/
├── 00-namespace.yaml
├── 01-configmap.yaml
├── 02-secrets.yaml
├── 04-postgres.yaml (미사용 - RDS 사용)
├── 05-redis.yaml
├── 06-main-api.yaml
├── 07-ai-services.yaml
├── 08-crawler-scheduler.yaml
├── 09-frontend.yaml (미사용 - S3/CloudFront 사용)
├── 10-ingress.yaml
└── 11-monitoring-ingress.yaml
```

## 🗄️ 외부 리소스

- **RDS PostgreSQL**: fans-db (db.t3.medium)
- **S3**: fans-profile-images-907123164281
- **CloudFront**: 프론트엔드 배포
- **ALB**: k8s-fans-fansingr-6558ffcd0e
- **NAT Gateway**: 2개 (각 AZ)

## ⚠️ 주의사항

1. **RDS는 EKS 외부**에 있습니다 (RDS 콘솔에서 관리)
2. **프론트엔드는 S3+CloudFront**로 배포됩니다
3. **NodeGroup 축소 시에도 EKS 컨트롤 플레인, RDS, ALB, NAT Gateway는 과금**됩니다
