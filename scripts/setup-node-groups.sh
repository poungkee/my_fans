#!/bin/bash

# EKS Node Group 자동 설정 스크립트
# 실행: chmod +x setup-node-groups.sh && ./setup-node-groups.sh

set -e

CLUSTER_NAME="fans-cluster"
REGION="ap-northeast-2"

echo "=========================================="
echo "EKS Node Group 설정 시작"
echo "=========================================="

# 1. 사전 확인
echo ""
echo "[1/6] 사전 확인 중..."

if ! command -v eksctl &> /dev/null; then
    echo "❌ eksctl이 설치되지 않았습니다."
    echo "설치 방법: brew install eksctl (macOS) 또는 docs/NODE_GROUP_SETUP.md 참고"
    exit 1
fi

if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl이 설치되지 않았습니다."
    exit 1
fi

echo "✅ eksctl, kubectl 확인 완료"

# 2. AWS 자격 증명 확인
echo ""
echo "[2/6] AWS 자격 증명 확인 중..."
aws sts get-caller-identity > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ AWS 자격 증명 실패"
    echo "aws configure 실행 필요"
    exit 1
fi
echo "✅ AWS 자격 증명 확인 완료"

# 3. General Workers 생성
echo ""
echo "[3/6] General Workers Node Group 생성 중..."
echo "  - 타입: t3.large"
echo "  - 개수: 2개 (2a/2b 각 1개)"
echo "  - 예상 시간: 3-5분"

eksctl create nodegroup \
  --cluster=$CLUSTER_NAME \
  --name=fans-general-workers \
  --region=$REGION \
  --node-type=t3.large \
  --nodes=2 \
  --nodes-min=2 \
  --nodes-max=2 \
  --node-labels="role=general-worker,workload=general,karpenter=false" \
  --node-volume-size=50 \
  --node-volume-type=gp3 \
  --managed \
  --asg-access

echo "✅ General Workers 생성 완료"

# 4. AI Workers 생성
echo ""
echo "[4/6] AI Workers Node Group 생성 중..."
echo "  - 타입: t3a.xlarge"
echo "  - 개수: 2개 (2a/2b 각 1개)"
echo "  - 예상 시간: 3-5분"

eksctl create nodegroup \
  --cluster=$CLUSTER_NAME \
  --name=fans-ai-workers \
  --region=$REGION \
  --node-type=t3a.xlarge \
  --nodes=2 \
  --nodes-min=2 \
  --nodes-max=2 \
  --node-labels="role=ai-worker,workload=ai,karpenter=false" \
  --node-volume-size=50 \
  --node-volume-type=gp3 \
  --managed \
  --asg-access

echo "✅ AI Workers 생성 완료"

# 5. 노드 확인
echo ""
echo "[5/6] 노드 배치 확인 중..."
sleep 10

echo ""
echo "=== 전체 노드 목록 ==="
kubectl get nodes -L role,workload,topology.kubernetes.io/zone

echo ""
echo "=== General Workers ==="
kubectl get nodes -l role=general-worker

echo ""
echo "=== AI Workers ==="
kubectl get nodes -l role=ai-worker

# 6. Pod nodeSelector 추가
echo ""
echo "[6/6] Pod에 nodeSelector 추가 중..."

# 일반 서비스
kubectl patch deployment main-api -n fans --patch '
spec:
  template:
    spec:
      nodeSelector:
        workload: general
' --type=strategic

kubectl patch deployment scheduler -n fans --patch '
spec:
  template:
    spec:
      nodeSelector:
        workload: general
' --type=strategic

kubectl patch deployment unified-crawler -n fans --patch '
spec:
  template:
    spec:
      nodeSelector:
        workload: general
' --type=strategic

# AI 서비스
kubectl patch deployment summarize-ai -n fans --patch '
spec:
  template:
    spec:
      nodeSelector:
        workload: ai
' --type=strategic

kubectl patch deployment bias-analysis-ai -n fans --patch '
spec:
  template:
    spec:
      nodeSelector:
        workload: ai
' --type=strategic

kubectl patch deployment ai-worker -n fans --patch '
spec:
  template:
    spec:
      nodeSelector:
        workload: ai
' --type=strategic

echo "✅ nodeSelector 추가 완료"

# 완료
echo ""
echo "=========================================="
echo "✅ Node Group 설정 완료!"
echo "=========================================="
echo ""
echo "다음 단계:"
echo "1. Pod 재배치 확인: kubectl get pods -n fans -o wide"
echo "2. 기존 Karpenter 노드 제거 (선택): kubectl get nodes -l karpenter.sh/nodepool"
echo "3. 모든 Pod가 Running 상태인지 확인"
echo ""
echo "비용:"
echo "  - General Workers (t3.large × 2): ~$120/월"
echo "  - AI Workers (t3a.xlarge × 2): ~$110/월"
echo "  - 총: ~$230/월"
