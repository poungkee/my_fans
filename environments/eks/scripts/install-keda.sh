#!/bin/bash
set -e

# KEDA 설치 스크립트
# Kubernetes Event Driven Autoscaling

echo "================================"
echo "KEDA 설치 시작"
echo "================================"

# 1. KEDA Helm Repo 추가
echo "1. KEDA Helm 저장소 추가 중..."
helm repo add kedacore https://kedacore.github.io/charts
helm repo update

# 2. KEDA 설치
echo "2. KEDA 설치 중..."
kubectl create namespace keda || echo "Namespace already exists"

helm upgrade --install keda kedacore/keda \
  --namespace keda \
  --version 2.12.0 \
  --set operator.replicaCount=2 \
  --set metricsServer.replicaCount=2 \
  --set webhooks.replicaCount=2 \
  --wait

echo "✅ KEDA 설치 완료"
echo ""

# 3. KEDA 상태 확인
echo "3. KEDA 상태 확인..."
kubectl get pods -n keda

echo ""
echo "================================"
echo "✅ KEDA 설치 완료!"
echo "================================"
echo ""
echo "다음 명령어로 ScaledObject 적용:"
echo "  kubectl apply -f ../manifests/16-keda-scaledobject.yaml"
echo ""
echo "ScaledObject 확인:"
echo "  kubectl get scaledobjects -n fans"
echo "  kubectl describe scaledobject ai-worker-scaler -n fans"
echo ""
echo "HPA 자동 생성 확인:"
echo "  kubectl get hpa -n fans"
