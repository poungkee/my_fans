#!/bin/bash

# Private 서브넷 IDs
PRIVATE_SUBNETS="subnet-0b867d77f680289c9,subnet-0e2a69045a3fbad50,subnet-0a18aaaed6f48aa19"

echo "🔒 Private 노드그룹 생성 중..."

# t3.medium 노드그룹 생성
eksctl create nodegroup \
  --cluster=fans-cluster \
  --region=ap-northeast-2 \
  --name=fans-private-medium \
  --node-type=t3.medium \
  --nodes=3 \
  --nodes-min=2 \
  --nodes-max=5 \
  --node-volume-size=30 \
  --node-volume-type=gp3 \
  --subnet-ids=$PRIVATE_SUBNETS \
  --node-private-networking \
  --managed &

MEDIUM_PID=$!

# t3.large 노드그룹 생성
eksctl create nodegroup \
  --cluster=fans-cluster \
  --region=ap-northeast-2 \
  --name=fans-private-large \
  --node-type=t3.large \
  --nodes=3 \
  --nodes-min=2 \
  --nodes-max=5 \
  --node-volume-size=30 \
  --node-volume-type=gp3 \
  --subnet-ids=$PRIVATE_SUBNETS \
  --node-private-networking \
  --managed &

LARGE_PID=$!

echo "⏳ 노드그룹 생성 대기 중..."
wait $MEDIUM_PID
wait $LARGE_PID

echo "✅ Private 노드그룹 생성 완료!"
