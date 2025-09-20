#!/bin/bash

echo "🚀 FANS 백엔드 개발환경 시작..."

# Docker가 실행 중인지 확인
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker가 실행되지 않았습니다. Docker Desktop을 실행해주세요."
    exit 1
fi

# 개발환경 컨테이너 시작 (PostgreSQL + API Dev)
echo "📦 개발환경 컨테이너 시작 중..."
docker-compose --profile dev up -d postgres
echo "⏳ PostgreSQL 컨테이너가 준비될 때까지 대기 중..."
docker-compose --profile dev up -d api-dev

echo "✅ 개발환경이 시작되었습니다!"
echo "📊 API 서버: http://localhost:3000"
echo "🗄️  PostgreSQL: localhost:5432"
echo ""
echo "🔧 유용한 명령어:"
echo "  로그 확인: docker-compose logs -f api-dev"
echo "  컨테이너 중지: docker-compose --profile dev down"
echo "  데이터베이스 초기화: docker-compose down -v && docker-compose --profile dev up -d"