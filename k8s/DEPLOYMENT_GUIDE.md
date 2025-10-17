# FANS EKS 배포 가이드

도메인: `fans.ai.kr`
인프라: AWS EKS + RDS + ElastiCache + ALB

---

## 📋 사전 준비

### 1. 필수 도구 설치

```bash
# AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# eksctl
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin

# helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### 2. AWS 자격증명 설정

```bash
aws configure
# AWS Access Key ID: <your-key>
# AWS Secret Access Key: <your-secret>
# Default region: ap-northeast-2
# Default output format: json
```

---

## 🚀 Step 1: AWS 인프라 생성

```bash
cd k8s
chmod +x setup-aws-infra.sh
./setup-aws-infra.sh
```

**생성되는 리소스:**
- EKS 클러스터 (fans-eks-cluster)
- RDS PostgreSQL (Multi-AZ)
- ElastiCache Redis
- ECR 리포지토리 7개
- ACM 인증서
- 보안 그룹, 서브넷 등

**⏳ 소요 시간:** 약 30분

**완료 후:**
1. ACM 인증서 DNS 검증 확인
2. RDS 엔드포인트 확인
3. Redis 엔드포인트 확인

---

## 🐳 Step 2: Docker 이미지 빌드 & ECR 푸시

```bash
chmod +x build-and-push-images.sh
./build-and-push-images.sh
```

**빌드되는 이미지:**
1. fans-main-api
2. fans-frontend
3. fans-api-crawler
4. fans-classification-api
5. fans-summarize-ai
6. fans-bias-analysis-ai
7. fans-scheduler

**⏳ 소요 시간:** 약 20-30분

---

## 🔐 Step 3: Secret 설정

### 3.1 RDS 및 Redis 엔드포인트 확인

```bash
# RDS 엔드포인트
export DB_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier fans-postgres \
  --region ap-northeast-2 \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

# Redis 엔드포인트
export REDIS_ENDPOINT=$(aws elasticache describe-cache-clusters \
  --cache-cluster-id fans-redis \
  --show-cache-node-info \
  --region ap-northeast-2 \
  --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' \
  --output text)

echo "DB_ENDPOINT: $DB_ENDPOINT"
echo "REDIS_ENDPOINT: $REDIS_ENDPOINT"
```

### 3.2 Secret 값들을 Base64로 인코딩

```bash
# 예시
echo -n "$DB_ENDPOINT" | base64
echo -n "your-db-password" | base64
echo -n "$REDIS_ENDPOINT" | base64
echo -n "your-jwt-secret" | base64
echo -n "your-kakao-client-id" | base64
echo -n "your-kakao-client-secret" | base64
echo -n "your-huggingface-token" | base64
```

### 3.3 k8s/base/secret.yaml 파일 수정

위에서 생성한 base64 값들을 `secret.yaml`에 입력합니다.

---

## ☸️ Step 4: Kubernetes 배포

### 4.1 kubectl 설정

```bash
aws eks update-kubeconfig --name fans-eks-cluster --region ap-northeast-2
kubectl get nodes  # 노드 확인
```

### 4.2 Ingress 설정 업데이트

`k8s/base/ingress.yaml` 파일에서 다음 변수들을 실제 값으로 교체:

```yaml
annotations:
  alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:ap-northeast-2:xxxxx:certificate/xxxxx
  alb.ingress.kubernetes.io/security-groups: sg-xxxxx
  alb.ingress.kubernetes.io/load-balancer-attributes: access_logs.s3.enabled=true,access_logs.s3.bucket=fans-alb-logs
```

### 4.3 Deployment 이미지 경로 업데이트

모든 deployment yaml 파일에서 `${AWS_ACCOUNT_ID}`를 실제 AWS Account ID로 교체:

```bash
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)

# 자동 치환
find k8s/base -name "*.yaml" -exec sed -i "s/\${AWS_ACCOUNT_ID}/$AWS_ACCOUNT_ID/g" {} \;
```

### 4.4 배포 실행

```bash
cd k8s
kubectl apply -k base/

# 배포 상태 확인
kubectl get pods -n fans
kubectl get svc -n fans
kubectl get ingress -n fans
```

---

## 🌐 Step 5: Route 53 DNS 설정

### 5.1 ALB 주소 확인

```bash
ALB_DNS=$(kubectl get ingress fans-ingress -n fans \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

echo "ALB DNS: $ALB_DNS"
```

### 5.2 Route 53 레코드 생성

```bash
# Hosted Zone ID 확인
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name "fans.ai.kr" \
  --query "HostedZones[0].Id" \
  --output text | sed 's|/hostedzone/||')

# ALB의 Hosted Zone ID 가져오기
ALB_HOSTED_ZONE_ID=$(aws elbv2 describe-load-balancers \
  --query "LoadBalancers[?DNSName=='$ALB_DNS'].CanonicalHostedZoneId" \
  --output text)

# A 레코드 생성 (fans.ai.kr)
cat > change-batch-root.json <<EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "fans.ai.kr",
      "Type": "A",
      "AliasTarget": {
        "HostedZoneId": "$ALB_HOSTED_ZONE_ID",
        "DNSName": "$ALB_DNS",
        "EvaluateTargetHealth": false
      }
    }
  }]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file://change-batch-root.json

# api.fans.ai.kr 레코드
cat > change-batch-api.json <<EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "api.fans.ai.kr",
      "Type": "A",
      "AliasTarget": {
        "HostedZoneId": "$ALB_HOSTED_ZONE_ID",
        "DNSName": "$ALB_DNS",
        "EvaluateTargetHealth": false
      }
    }
  }]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file://change-batch-api.json

# ai.fans.ai.kr 레코드
cat > change-batch-ai.json <<EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "ai.fans.ai.kr",
      "Type": "A",
      "AliasTarget": {
        "HostedZoneId": "$ALB_HOSTED_ZONE_ID",
        "DNSName": "$ALB_DNS",
        "EvaluateTargetHealth": false
      }
    }
  }]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file://change-batch-ai.json
```

---

## ✅ Step 6: 배포 확인

### 6.1 Pod 상태 확인

```bash
kubectl get pods -n fans -w
```

모든 Pod이 `Running` 상태가 될 때까지 대기합니다.

### 6.2 서비스 테스트

```bash
# Frontend
curl -I https://fans.ai.kr

# API Health Check
curl https://api.fans.ai.kr/health

# AI Services
curl https://ai.fans.ai.kr/summarize/health
curl https://ai.fans.ai.kr/bias-analysis/health
```

### 6.3 로그 확인

```bash
# Main API 로그
kubectl logs -f deployment/main-api -n fans

# Scheduler 로그
kubectl logs -f deployment/scheduler -n fans

# Crawler 로그
kubectl logs -f deployment/api-crawler -n fans
```

---

## 🔧 유용한 명령어

### Pod 재시작

```bash
kubectl rollout restart deployment/main-api -n fans
```

### 스케일링

```bash
kubectl scale deployment/main-api --replicas=5 -n fans
```

### Pod 접속

```bash
kubectl exec -it deployment/main-api -n fans -- /bin/bash
```

### ConfigMap 업데이트

```bash
kubectl edit configmap fans-config -n fans
kubectl rollout restart deployment/main-api -n fans  # 변경 적용
```

### Secret 업데이트

```bash
kubectl edit secret fans-secrets -n fans
kubectl rollout restart deployment/main-api -n fans
```

---

## 📊 모니터링

### CloudWatch 로그 설정

```bash
# CloudWatch 에이전트 설치
kubectl apply -f https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/latest/k8s-deployment-manifest-templates/deployment-mode/daemonset/container-insights-monitoring/cloudwatch-namespace.yaml

kubectl apply -f https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/latest/k8s-deployment-manifest-templates/deployment-mode/daemonset/container-insights-monitoring/cwagent/cwagent-daemonset.yaml
```

### 메트릭 확인

AWS Console → CloudWatch → Container Insights

---

## 💰 비용 최적화

### Spot Instances 사용

```bash
eksctl create nodegroup \
  --cluster=fans-eks-cluster \
  --name=fans-spot-nodegroup \
  --instance-types=t3.medium,t3a.medium \
  --spot \
  --nodes=3 \
  --nodes-min=2 \
  --nodes-max=5
```

### Auto Scaling 설정

```bash
# Cluster Autoscaler 설치
kubectl apply -f https://raw.githubusercontent.com/kubernetes/autoscaler/master/cluster-autoscaler/cloudprovider/aws/examples/cluster-autoscaler-autodiscover.yaml
```

---

## 🆘 트러블슈팅

### Pod이 Pending 상태

```bash
kubectl describe pod <pod-name> -n fans
# Events 섹션 확인
```

**일반적인 원인:**
- 리소스 부족 (CPU/메모리)
- PVC 바인딩 실패
- 이미지 pull 실패

### 503 Service Unavailable

- Ingress 설정 확인
- 서비스 selector 확인
- Pod readiness probe 확인

### RDS 연결 실패

- 보안 그룹 확인
- Secret의 DB 정보 확인
- RDS 엔드포인트 확인

---

## 🔄 업데이트 배포

```bash
# 1. 이미지 재빌드 및 푸시
./build-and-push-images.sh

# 2. Deployment 업데이트
kubectl set image deployment/main-api main-api=${ECR_PREFIX}-main-api:latest -n fans

# 또는 전체 재배포
kubectl apply -k base/
```

---

## 🗑️ 리소스 정리

```bash
# Kubernetes 리소스 삭제
kubectl delete -k base/

# EKS 클러스터 삭제
eksctl delete cluster --name fans-eks-cluster --region ap-northeast-2

# RDS 삭제
aws rds delete-db-instance --db-instance-identifier fans-postgres --skip-final-snapshot

# Redis 삭제
aws elasticache delete-cache-cluster --cache-cluster-id fans-redis

# ECR 리포지토리 삭제
aws ecr delete-repository --repository-name fans-main-api --force
# ... (나머지 리포지토리들도 삭제)
```

---

## 📞 지원

문제가 발생하면 다음을 확인하세요:
1. Pod 로그: `kubectl logs <pod-name> -n fans`
2. Events: `kubectl get events -n fans --sort-by='.lastTimestamp'`
3. Ingress 상태: `kubectl describe ingress fans-ingress -n fans`
