#!/bin/bash

# EKS NodeGroup 스케일 조정 스크립트
# 사용법: ./scale-nodegroup.sh [start|stop]

CLUSTER_NAME="fans-cluster-2az"
REGION="ap-northeast-2"
NODEGROUP_MEDIUM="fans-private-medium-2az"
NODEGROUP_LARGE="fans-private-large-2az"

if [ "$1" == "stop" ]; then
    echo "⏸️  NodeGroup 축소 (비용 절감 모드)"
    echo "================================"

    echo "📉 Medium NodeGroup 0으로 축소..."
    aws eks update-nodegroup-config \
      --cluster-name $CLUSTER_NAME \
      --nodegroup-name $NODEGROUP_MEDIUM \
      --scaling-config minSize=0,maxSize=2,desiredSize=0 \
      --region $REGION

    echo "📉 Large NodeGroup 0으로 축소..."
    aws eks update-nodegroup-config \
      --cluster-name $CLUSTER_NAME \
      --nodegroup-name $NODEGROUP_LARGE \
      --scaling-config minSize=0,maxSize=2,desiredSize=0 \
      --region $REGION

    echo ""
    echo "✅ NodeGroup 축소 완료"
    echo "💰 일일 비용: ~$6.72/일 (54% 절감)"
    echo ""
    echo "⚠️  주의: EKS 컨트롤 플레인, RDS, ALB, NAT Gateway는 계속 과금됩니다."

elif [ "$1" == "start" ]; then
    echo "▶️  NodeGroup 재시작"
    echo "================================"

    echo "📈 Medium NodeGroup 2로 확장..."
    aws eks update-nodegroup-config \
      --cluster-name $CLUSTER_NAME \
      --nodegroup-name $NODEGROUP_MEDIUM \
      --scaling-config minSize=2,maxSize=4,desiredSize=2 \
      --region $REGION

    echo "📈 Large NodeGroup 2로 확장..."
    aws eks update-nodegroup-config \
      --cluster-name $CLUSTER_NAME \
      --nodegroup-name $NODEGROUP_LARGE \
      --scaling-config minSize=2,maxSize=4,desiredSize=2 \
      --region $REGION

    echo ""
    echo "✅ NodeGroup 재시작 완료"
    echo "⏳ 노드가 준비될 때까지 2-3분 대기하세요..."
    echo ""
    echo "📊 노드 상태 확인: kubectl get nodes"

else
    echo "사용법: ./scale-nodegroup.sh [start|stop]"
    echo ""
    echo "  start - NodeGroup 재시작 (2개 노드)"
    echo "  stop  - NodeGroup 축소 (0개 노드, 비용 절감)"
    exit 1
fi
