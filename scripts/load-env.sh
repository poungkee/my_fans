#!/bin/bash
# scripts/load-env.sh
# 환경을 자동으로 감지하고 적절한 .env 파일을 로드

set -e

echo "🔍 환경 감지 중..."

# 환경 감지 함수
detect_environment() {
    # 1. ECS 환경 체크 (ECS 컨테이너 메타데이터 URI가 존재)
    if [ ! -z "$ECS_CONTAINER_METADATA_URI" ] || [ ! -z "$ECS_CONTAINER_METADATA_URI_V4" ]; then
        echo "ecs"
        return
    fi

    # 2. EKS/Kubernetes 환경 체크
    if [ ! -z "$KUBERNETES_SERVICE_HOST" ]; then
        echo "eks"
        return
    fi

    # 3. 명시적 환경변수 체크 (우선순위 높음)
    if [ ! -z "$DEPLOY_ENV" ]; then
        echo "$DEPLOY_ENV"
        return
    fi

    # 4. AWS EC2 인스턴스 체크 (ECS/EKS 아닌 EC2)
    if [ -f /sys/hypervisor/uuid ] && grep -q ec2 /sys/hypervisor/uuid 2>/dev/null; then
        # EC2지만 컨테이너 환경 아니면 일반 배포로 간주
        echo "local"  # 또는 별도 환경
        return
    fi

    # 5. 기본값: 로컬 개발 환경
    echo "local"
}

# 환경 감지
ENV=$(detect_environment)
ENV_FILE=".env.${ENV}"

echo "┌─────────────────────────────────────┐"
echo "│  FANS 환경 자동 감지                │"
echo "├─────────────────────────────────────┤"
echo "│  감지된 환경: ${ENV}"
echo "│  사용할 파일: ${ENV_FILE}"
echo "└─────────────────────────────────────┘"

# 루트 디렉토리로 이동 (스크립트가 어디서 실행되든)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

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

# 기존 .env 백업 (선택사항, 개발 중에는 유용)
if [ -f ".env" ] && [ "$ENV" != "local" ]; then
    BACKUP_FILE=".env.backup.$(date +%Y%m%d_%H%M%S)"
    cp .env "$BACKUP_FILE"
    echo "📦 기존 .env → ${BACKUP_FILE} 백업 완료"
fi

# .env로 복사
cp "$ENV_FILE" .env
echo "✅ ${ENV_FILE} → .env 복사 완료"

# 환경변수 내보내기 (선택사항)
# 주의: 이 방법은 현재 쉘에서만 유효
if [ "$1" == "--export" ]; then
    echo "📤 환경변수 내보내기 중..."
    set -a  # 이후 모든 변수를 자동 export
    source .env
    set +a
    echo "✅ 환경변수 로드 완료"
fi

echo ""
echo "🎯 현재 환경: ${ENV}"
echo "💡 Tip: DEPLOY_ENV 환경변수로 수동 지정 가능"
echo "   예: DEPLOY_ENV=ecs ./scripts/load-env.sh"
