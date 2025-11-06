# EKS Node Group 설정 가이드

## 개요
EKS 클러스터에 고가용성(HA)을 위한 고정 Node Group 4개를 추가합니다.

**목표 구성**:
- **General Workers**: t3.large × 2 (2a/2b 각 1개) - 일반 서비스용
- **AI Workers**: t3a.xlarge × 2 (2a/2b 각 1개) - AI 서비스용
- **Karpenter**: 추가 부하 발생 시 임시 노드 동적 생성

---

## 사전 준비

### 1. eksctl 설치 확인
```bash
eksctl version
```

설치되지 않았다면:
```bash
# macOS
brew install eksctl

# Linux
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin
```

### 2. AWS 자격 증명 확인
```bash
aws sts get-caller-identity
aws eks update-kubeconfig --name fans-cluster --region ap-northeast-2
```

---

## Node Group 생성

### Step 1: General Workers 생성 (일반 서비스)

```bash
eksctl create nodegroup \
  --cluster=fans-cluster \
  --name=fans-general-workers \
  --region=ap-northeast-2 \
  --node-type=t3.large \
  --nodes=2 \
  --nodes-min=2 \
  --nodes-max=2 \
  --node-labels="role=general-worker,workload=general,karpenter=false" \
  --node-volume-size=50 \
  --node-volume-type=gp3 \
  --managed \
  --asg-access
```

**예상 시간**: 3-5분

**생성 확인**:
```bash
kubectl get nodes -l role=general-worker
```

---

### Step 2: AI Workers 생성 (AI 서비스)

```bash
eksctl create nodegroup \
  --cluster=fans-cluster \
  --name=fans-ai-workers \
  --region=ap-northeast-2 \
  --node-type=t3a.xlarge \
  --nodes=2 \
  --nodes-min=2 \
  --nodes-max=2 \
  --node-labels="role=ai-worker,workload=ai,karpenter=false" \
  --node-volume-size=50 \
  --node-volume-type=gp3 \
  --managed \
  --asg-access
```

**예상 시간**: 3-5분

**생성 확인**:
```bash
kubectl get nodes -l role=ai-worker
```

---

### Step 3: 전체 노드 확인

```bash
echo "=== 전체 노드 목록 ==="
kubectl get nodes -o wide

echo -e "\n=== 2a 노드 ==="
kubectl get nodes -l topology.kubernetes.io/zone=ap-northeast-2a

echo -e "\n=== 2b 노드 ==="
kubectl get nodes -l topology.kubernetes.io/zone=ap-northeast-2b

echo -e "\n=== Node Group별 노드 ==="
kubectl get nodes -L role,workload
```

**기대 결과**:
- 총 4개 노드 (기존 Karpenter 노드 제외)
- 2a: general-worker 1개, ai-worker 1개
- 2b: general-worker 1개, ai-worker 1개

---

## 기존 Karpenter 노드 제거

새로운 Node Group이 정상 작동하면 기존 Karpenter 노드를 제거합니다.

### 1. 기존 Karpenter 노드 확인
```bash
kubectl get nodes -l karpenter.sh/nodepool
```

### 2. 노드별로 drain 및 삭제
```bash
# 노드 목록 확인
KARPENTER_NODES=$(kubectl get nodes -l karpenter.sh/nodepool -o name)

# 각 노드를 drain하고 삭제
for node in $KARPENTER_NODES; do
  echo "Draining $node..."
  kubectl drain $node --ignore-daemonsets --delete-emptydir-data --force
  kubectl delete $node
done
```

### 3. Pod가 새 노드로 이동했는지 확인
```bash
kubectl get pods -n fans -o wide
```

---

## Pod 재배치 (Node Selector 추가)

Pod들이 올바른 Node Group에 배치되도록 설정합니다.

### 일반 서비스 → General Workers

**main-api, scheduler, unified-crawler**:
```bash
# main-api
kubectl patch deployment main-api -n fans --patch '
spec:
  template:
    spec:
      nodeSelector:
        workload: general
'

# scheduler
kubectl patch deployment scheduler -n fans --patch '
spec:
  template:
    spec:
      nodeSelector:
        workload: general
'

# unified-crawler
kubectl patch deployment unified-crawler -n fans --patch '
spec:
  template:
    spec:
      nodeSelector:
        workload: general
'
```

### AI 서비스 → AI Workers

**summarize-ai, bias-analysis-ai, ai-worker**:
```bash
# summarize-ai
kubectl patch deployment summarize-ai -n fans --patch '
spec:
  template:
    spec:
      nodeSelector:
        workload: ai
'

# bias-analysis-ai
kubectl patch deployment bias-analysis-ai -n fans --patch '
spec:
  template:
    spec:
      nodeSelector:
        workload: ai
'

# ai-worker
kubectl patch deployment ai-worker -n fans --patch '
spec:
  template:
    spec:
      nodeSelector:
        workload: ai
'
```

### 재배치 확인
```bash
echo "=== General Workers의 Pod ==="
kubectl get pods -n fans -o wide | grep -E "main-api|scheduler|unified-crawler"

echo -e "\n=== AI Workers의 Pod ==="
kubectl get pods -n fans -o wide | grep -E "summarize-ai|bias-analysis|ai-worker"
```

---

## 비용 확인

### 월간 예상 비용 (On-Demand)
- **t3.large × 2**: ~$60/월 × 2 = $120/월
- **t3a.xlarge × 2**: ~$55/월 × 2 = $110/월
- **총 기본 노드**: ~$230/월
- **NAT Gateway × 2**: ~$64/월
- **RDS, ElastiCache**: 별도

### Karpenter 추가 노드 (필요 시만)
- Spot 인스턴스 사용 시 60-90% 절감
- 트래픽 증가 시에만 생성

---

## 문제 해결

### Pod가 Pending 상태인 경우
```bash
# Pod 상태 확인
kubectl describe pod <pod-name> -n fans

# 노드 리소스 확인
kubectl describe node <node-name>
```

### Node Group이 2a/2b에 균등 배치되지 않은 경우
AWS Auto Scaling Group 설정 확인:
```bash
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names <asg-name> \
  --region ap-northeast-2
```

### 노드 삭제 실패
```bash
# 강제 삭제
kubectl delete node <node-name> --force --grace-period=0
```

---

## 롤백 (문제 발생 시)

### Node Group 삭제
```bash
# General Workers 삭제
eksctl delete nodegroup \
  --cluster=fans-cluster \
  --name=fans-general-workers \
  --region=ap-northeast-2

# AI Workers 삭제
eksctl delete nodegroup \
  --cluster=fans-cluster \
  --name=fans-ai-workers \
  --region=ap-northeast-2
```

### Karpenter로 복구
Karpenter가 자동으로 필요한 노드를 다시 생성합니다.

---

## 완료 체크리스트

- [ ] eksctl 설치 완료
- [ ] General Workers Node Group 생성 완료 (2개)
- [ ] AI Workers Node Group 생성 완료 (2개)
- [ ] 노드가 2a/2b에 균등 배치 확인
- [ ] 기존 Karpenter 노드 제거 완료
- [ ] Pod에 nodeSelector 추가 완료
- [ ] 모든 Pod가 Running 상태 확인
- [ ] ai-worker Pod Redis 연결 정상 확인

---

## 참고 자료
- [eksctl 공식 문서](https://eksctl.io/)
- [EKS Managed Node Groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)
- [Kubernetes Node Selector](https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/)
