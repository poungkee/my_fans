#!/bin/bash
# scripts/docker-start.sh
# 환경을 자동 감지하고 Docker Compose 실행

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}┌─────────────────────────────────────┐${NC}"
echo -e "${GREEN}│  FANS Docker Compose 시작           │${NC}"
echo -e "${GREEN}└─────────────────────────────────────┘${NC}"

# 1. 환경 감지 및 .env 로드
echo -e "\n${YELLOW}🔍 환경 감지 및 설정 로드...${NC}"
bash ./scripts/load-env.sh

# 2. Docker Compose 서비스 시작
echo -e "\n${YELLOW}🐳 Docker Compose 시작...${NC}"

# DEPLOY_ENV 환경변수가 설정되어 있으면 사용
if [ -z "$DEPLOY_ENV" ]; then
    # 현재 .env 파일에서 환경 추측
    if diff -q .env .env.local > /dev/null 2>&1; then
        export DEPLOY_ENV=local
    elif diff -q .env .env.ecs > /dev/null 2>&1; then
        export DEPLOY_ENV=ecs
    elif diff -q .env .env.eks > /dev/null 2>&1; then
        export DEPLOY_ENV=eks
    else
        export DEPLOY_ENV=local
    fi
fi

echo -e "${GREEN}📍 사용 환경: ${DEPLOY_ENV}${NC}"

# 환경별 추가 설정 파일 사용 여부 확인
if [ -f "docker-compose.${DEPLOY_ENV}.yml" ]; then
    echo -e "${GREEN}✅ docker-compose.${DEPLOY_ENV}.yml 오버라이드 적용${NC}"
    docker-compose -f docker-compose.yml -f "docker-compose.${DEPLOY_ENV}.yml" up -d "$@"
else
    echo -e "${YELLOW}ℹ️  기본 docker-compose.yml 사용${NC}"
    docker-compose up -d "$@"
fi

echo -e "\n${GREEN}┌─────────────────────────────────────┐${NC}"
echo -e "${GREEN}│  ✅ Docker Compose 시작 완료        │${NC}"
echo -e "${GREEN}└─────────────────────────────────────┘${NC}"

# 3. 서비스 상태 확인
echo -e "\n${YELLOW}📊 서비스 상태:${NC}"
docker-compose ps

# 4. 유용한 명령어 안내
echo -e "\n${YELLOW}💡 유용한 명령어:${NC}"
echo "  로그 확인:     docker-compose logs -f"
echo "  특정 서비스:   docker-compose logs -f main-api"
echo "  중지:          docker-compose down"
echo "  재시작:        docker-compose restart <service-name>"
