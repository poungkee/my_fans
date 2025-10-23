#!/bin/bash
# scripts/switch-env.sh
# 환경을 수동으로 전환하는 스크립트

set -e

ENVIRONMENTS=("local" "ecs" "eks")

# 사용법 출력
usage() {
    echo "사용법: $0 <environment>"
    echo ""
    echo "환경 옵션:"
    echo "  local  - 로컬 Docker Compose 개발"
    echo "  ecs    - AWS ECS 배포"
    echo "  eks    - AWS EKS (Kubernetes) 배포"
    echo ""
    echo "예시:"
    echo "  $0 local"
    echo "  $0 ecs"
    exit 1
}

# 인자 확인
if [ $# -eq 0 ]; then
    usage
fi

ENV=$1

# 유효성 검사
if [[ ! " ${ENVIRONMENTS[@]} " =~ " ${ENV} " ]]; then
    echo "❌ 오류: 잘못된 환경입니다."
    echo ""
    usage
fi

# 루트 디렉토리로 이동
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

ENV_FILE=".env.${ENV}"

# 파일 존재 확인
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ 오류: ${ENV_FILE} 파일이 없습니다."
    echo ""
    echo "사용 가능한 환경 파일:"
    ls -1 .env.* 2>/dev/null || echo "  (환경 파일이 없습니다)"
    echo ""
    echo "템플릿에서 생성하세요:"
    echo "  cp .env.example ${ENV_FILE}"
    exit 1
fi

echo "┌─────────────────────────────────────┐"
echo "│  FANS 환경 전환                     │"
echo "└─────────────────────────────────────┘"

# 백업 (선택사항)
if [ -f ".env" ]; then
    # 현재 .env가 어느 환경인지 확인
    CURRENT_ENV="unknown"
    for e in "${ENVIRONMENTS[@]}"; do
        if diff -q ".env" ".env.$e" > /dev/null 2>&1; then
            CURRENT_ENV=$e
            break
        fi
    done

    if [ "$CURRENT_ENV" != "unknown" ]; then
        echo "📍 현재 환경: ${CURRENT_ENV}"
    fi

    # 백업 생성
    BACKUP_FILE=".env.backup.${CURRENT_ENV}.$(date +%Y%m%d_%H%M%S)"
    cp .env "$BACKUP_FILE"
    echo "📦 기존 .env → ${BACKUP_FILE} 백업 완료"
fi

# .env로 복사
cp "$ENV_FILE" .env
echo "✅ ${ENV_FILE} → .env 복사 완료"
echo ""
echo "┌─────────────────────────────────────┐"
echo "│  🎯 환경 전환 완료: ${ENV}"
echo "└─────────────────────────────────────┘"

# 환경별 추가 안내
case $ENV in
    local)
        echo ""
        echo "📝 다음 단계:"
        echo "  docker-compose up -d"
        ;;
    ecs)
        echo ""
        echo "📝 다음 단계:"
        echo "  1. Terraform으로 인프라 배포"
        echo "     cd infra/terraform"
        echo "     terraform apply -var='deploy_environment=ecs'"
        echo ""
        echo "  2. Docker 이미지 빌드 및 ECR 푸시"
        echo "     docker build --build-arg DEPLOY_ENV=ecs -t fans-api:ecs ."
        echo "     docker push ..."
        echo ""
        echo "⚠️  주의: OAuth Redirect URI를 카카오/네이버 콘솔에서 업데이트하세요!"
        ;;
    eks)
        echo ""
        echo "📝 다음 단계:"
        echo "  1. Terraform으로 EKS 클러스터 생성"
        echo "     cd infra/terraform"
        echo "     terraform apply -var='deploy_environment=eks'"
        echo ""
        echo "  2. Kubernetes 매니페스트 배포"
        echo "     kubectl apply -k k8s/overlays/eks"
        echo ""
        echo "⚠️  주의: OAuth Redirect URI를 카카오/네이버 콘솔에서 업데이트하세요!"
        ;;
esac

echo ""
echo "💡 Tip: 환경별 설정을 확인하세요:"
echo "   cat .env | grep -v '^#' | grep -v '^$'"
