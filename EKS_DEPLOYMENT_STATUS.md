# FANS 프로젝트 EKS 배포 상태

## 진행 상황

### ✅ 완료된 작업

1. **AWS 환경 및 도구 설정**
   - AWS CLI ✓
   - kubectl ✓
   - eksctl ✓
   - Docker ✓

2. **ECR 리포지토리 생성**
   - fans/main-api ✓
   - fans/frontend ✓
   - fans/summarize-ai ✓
   - fans/bias-analysis-ai ✓
   - fans/unified-crawler ✓
   - fans/classification-api ✓
   - fans/scheduler ✓

3. **Kubernetes 매니페스트 파일 작성**
   - `k8s/01-namespace.yaml` - Namespace 정의
   - `k8s/02-secrets.yaml` - Secrets (DB, JWT, OAuth 등)
   - `k8s/03-configmap.yaml` - ConfigMap (환경변수)
   - `k8s/04-postgres.yaml` - PostgreSQL Deployment & Service
   - `k8s/05-redis.yaml` - Redis Deployment & Service
   - `k8s/06-main-api.yaml` - Main API Deployment & Service
   - `k8s/07-ai-services.yaml` - AI Services (Summarize, Bias, Classification)
   - `k8s/08-crawler-scheduler.yaml` - Crawler & Scheduler
   - `k8s/09-frontend.yaml` - Frontend Deployment & Service
   - `k8s/10-ingress.yaml` - Ingress (ALB)

4. **SSL 인증서 요청**
   - ACM Certificate ARN: `arn:aws:acm:ap-northeast-2:907123164281:certificate/45f6e7fd-3bd2-41f6-ad30-6a2b1c5648df`
   - 도메인: www.fans.ai.kr

### 🔄 진행 중인 작업

1. **EKS 클러스터 생성**
   - 클러스터 이름: fans-cluster
   - 리전: ap-northeast-2
   - Kubernetes 버전: 1.31
   - 노드 그룹: t3.medium (2-5 노드)
   - 상태: VPC CNI 설정 중

2. **Docker 이미지 빌드 및 ECR 푸시**
   - main-api: ✅ 푸시 완료
   - frontend: ✅ 푸시 완료
   - summarize-ai: 🔄 빌드 중
   - bias-analysis-ai: 🔄 빌드 중
   - unified-crawler: 🔄 빌드 중
   - classification-api: 🔄 빌드 중
   - scheduler: 🔄 빌드 중

### ⏳ 대기 중인 작업

1. **SSL 인증서 DNS 검증**
   - 다음 CNAME 레코드를 도메인 DNS에 추가해야 합니다:

   ```
   Name:  _218f26db01db875216e912f0341300e7.www.fans.ai.kr.
   Type:  CNAME
   Value: _1a214829579b6d90424f90bea1501fe5.xlfgrmvvlj.acm-validations.aws.
   ```

2. **EKS 클러스터 완성 대기** (약 5-10분 소요)

3. **AWS Load Balancer Controller 설치**

4. **서비스 배포**
   - kubectl apply -f k8s/

5. **도메인 연결**
   - ALB 생성 후 DNS 레코드 업데이트
   - www.fans.ai.kr -> ALB DNS

---

## 다음 단계 (EKS 클러스터 준비 완료 후)

### 1단계: kubectl 설정
```bash
aws eks update-kubeconfig --region ap-northeast-2 --name fans-cluster
```

### 2단계: AWS Load Balancer Controller 설치
```bash
# IAM Policy 생성
curl -o iam_policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.7.1/docs/install/iam_policy.json
aws iam create-policy --policy-name AWSLoadBalancerControllerIAMPolicy --policy-document file://iam_policy.json

# ServiceAccount 생성
eksctl create iamserviceaccount \
  --cluster=fans-cluster \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --role-name AmazonEKSLoadBalancerControllerRole \
  --attach-policy-arn=arn:aws:iam::907123164281:policy/AWSLoadBalancerControllerIAMPolicy \
  --approve

# Helm으로 Controller 설치
helm repo add eks https://aws.github.io/eks-charts
helm repo update
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=fans-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

### 3단계: EBS CSI Driver 설치 (PostgreSQL PVC용)
```bash
# IAM Policy 생성 및 연결
eksctl create iamserviceaccount \
  --name ebs-csi-controller-sa \
  --namespace kube-system \
  --cluster fans-cluster \
  --role-name AmazonEKS_EBS_CSI_DriverRole \
  --attach-policy-arn arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy \
  --approve

# EBS CSI Driver addon 설치
eksctl create addon --name aws-ebs-csi-driver --cluster fans-cluster --service-account-role-arn arn:aws:iam::907123164281:role/AmazonEKS_EBS_CSI_DriverRole --force
```

### 4단계: PostgreSQL init.sql ConfigMap 생성
```bash
kubectl create configmap postgres-init-script \
  --from-file=init.sql=./backend/database/init.sql \
  -n fans
```

### 5단계: 모든 서비스 배포
```bash
kubectl apply -f k8s/01-namespace.yaml
kubectl apply -f k8s/02-secrets.yaml
kubectl apply -f k8s/03-configmap.yaml
kubectl apply -f k8s/
```

### 6단계: 배포 상태 확인
```bash
kubectl get pods -n fans
kubectl get svc -n fans
kubectl get ingress -n fans
```

### 7단계: ALB DNS 확인 및 도메인 연결
```bash
kubectl get ingress fans-ingress -n fans -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

위 명령어로 ALB DNS를 확인한 후, Route 53 또는 도메인 서비스에서:
- Type: A (Alias)
- Name: www.fans.ai.kr
- Value: ALB DNS

---

## 주요 설정 값

### 리소스 할당
- PostgreSQL: 512Mi-2Gi RAM, 250m-1000m CPU
- Redis: 128Mi-512Mi RAM, 100m-500m CPU
- Main API: 512Mi-1Gi RAM, 250m-1000m CPU (2 replicas)
- Summarize AI: 1Gi-2Gi RAM, 500m-2000m CPU (2 replicas)
- Bias Analysis AI: 512Mi-1Gi RAM, 250m-1000m CPU (2 replicas)
- Classification API: 512Mi-1Gi RAM, 250m-1000m CPU (2 replicas)
- Frontend: 256Mi-512Mi RAM, 100m-500m CPU (2 replicas)
- Unified Crawler: 512Mi-1Gi RAM, 250m-1000m CPU (1 replica)
- Scheduler: 256Mi-512Mi RAM, 100m-500m CPU (1 replica)

### 스토리지
- PostgreSQL PVC: 20Gi (gp3)

---

## 문제 해결

### Pod가 시작하지 않는 경우
```bash
kubectl describe pod <pod-name> -n fans
kubectl logs <pod-name> -n fans
```

### Ingress가 생성되지 않는 경우
```bash
kubectl describe ingress fans-ingress -n fans
kubectl get events -n fans
```

### 데이터베이스 연결 문제
Secrets와 ConfigMap의 환경변수를 확인하세요.

---

## 비용 예측

### EKS 클러스터
- Control Plane: $0.10/hour = ~$73/month
- t3.medium (3 nodes): $0.0416/hour × 3 = ~$90/month
- EBS gp3 20GB: ~$2/month
- ALB: ~$16/month
- 데이터 전송: 변동

**총 예상 비용: ~$180-200/month**

---

## 참고 사항

1. **Secrets 업데이트 필요**
   - `k8s/02-secrets.yaml`에서 실제 API 키로 교체:
     - NAVER_SEARCH_CLIENT_ID/SECRET
     - KAKAO_CLIENT_ID/SECRET
     - NAVER_CLIENT_ID/SECRET

2. **DNS 검증 완료 후 인증서 상태 확인**
   ```bash
   aws acm describe-certificate --certificate-arn arn:aws:acm:ap-northeast-2:907123164281:certificate/45f6e7fd-3bd2-41f6-ad30-6a2b1c5648df --region ap-northeast-2
   ```

3. **자동 스케일링 설정** (선택사항)
   - Horizontal Pod Autoscaler (HPA) 설정 가능
   - Cluster Autoscaler 설정 가능
