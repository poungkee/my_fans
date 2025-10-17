#!/bin/bash
# ========================================
# EKS 노드 부팅 스크립트
# ========================================

set -ex

# 클러스터 정보
CLUSTER_NAME="${cluster_name}"
CLUSTER_ENDPOINT="${cluster_endpoint}"
CLUSTER_CA="${cluster_ca}"

# 로그 설정
exec > >(tee /var/log/user-data.log)
exec 2>&1

echo "Starting EKS node initialization..."

# kubelet 추가 인자
KUBELET_EXTRA_ARGS=""

# Spot Instance인 경우 라벨 추가
TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
INSTANCE_LIFECYCLE=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" -s http://169.254.169.254/latest/meta-data/instance-life-cycle)

if [ "$INSTANCE_LIFECYCLE" == "spot" ]; then
  KUBELET_EXTRA_ARGS="$KUBELET_EXTRA_ARGS --node-labels=lifecycle=spot"
fi

# EKS 부트스트랩 실행
/etc/eks/bootstrap.sh "$CLUSTER_NAME" \
  --b64-cluster-ca "$CLUSTER_CA" \
  --apiserver-endpoint "$CLUSTER_ENDPOINT" \
  --kubelet-extra-args "$KUBELET_EXTRA_ARGS"

echo "EKS node initialization completed."
