#!/bin/bash

# EKS Kubernetes 매니페스트 배포 스크립트
# 사용법: ./deploy-manifests.sh

set -e

echo "🚀 FANS EKS 배포 시작"
echo "================================"

MANIFEST_DIR="../manifests"

# 클러스터 연결 확인
echo "📡 클러스터 연결 확인 중..."
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ 클러스터에 연결할 수 없습니다."
    echo "다음 명령어로 kubeconfig를 설정하세요:"
    echo "  aws eks update-kubeconfig --name fans-cluster-2az --region ap-northeast-2"
    exit 1
fi

echo "✅ 클러스터 연결됨"
echo ""

# 배포 순서대로 적용
echo "📦 Kubernetes 리소스 배포 중..."
echo ""

echo "1️⃣  StorageClass 생성..."
kubectl apply -f $MANIFEST_DIR/00-storageclass.yaml

echo "2️⃣  Namespace 생성..."
kubectl apply -f $MANIFEST_DIR/01-namespace.yaml

echo "3️⃣  Secrets 생성..."
kubectl apply -f $MANIFEST_DIR/02-secrets.yaml

echo "4️⃣  ConfigMap 생성..."
kubectl apply -f $MANIFEST_DIR/03-configmap.yaml

echo "5️⃣  Redis 배포..."
kubectl apply -f $MANIFEST_DIR/05-redis.yaml

echo "6️⃣  Main API 배포..."
kubectl apply -f $MANIFEST_DIR/06-main-api.yaml

echo "7️⃣  AI Services 배포..."
kubectl apply -f $MANIFEST_DIR/07-ai-services.yaml

echo "8️⃣  Crawler & Scheduler 배포..."
kubectl apply -f $MANIFEST_DIR/08-crawler-scheduler.yaml

echo "9️⃣  Ingress 생성..."
kubectl apply -f $MANIFEST_DIR/10-ingress.yaml

echo "🔟 Monitoring Ingress 생성..."
kubectl apply -f $MANIFEST_DIR/11-monitoring-ingress.yaml

echo ""
echo "✅ 배포 완료!"
echo ""
echo "📊 배포 상태 확인:"
kubectl get pods -n fans
echo ""
kubectl get svc -n fans
echo ""
kubectl get ingress -n fans

echo ""
echo "🌐 접속 주소:"
echo "  - API: https://api.fans.ai.kr"
echo "  - Frontend: https://www.fans.ai.kr"
echo "  - Grafana: https://monitoring.fans.ai.kr"
echo ""
echo "💡 Pod 로그 확인: kubectl logs -f deployment/main-api -n fans"
