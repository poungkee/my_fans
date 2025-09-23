#!/bin/bash

echo "🚀 FANS 프로젝트 서비스 시작"
echo "================================"
echo "포트 구성:"
echo "  - 데이터베이스 서버: 5432"
echo "  - AI 백엔드: 8000"
echo "  - 메인 백엔드: 3000"
echo "  - 프론트엔드: 3001"
echo "================================"

cd /home/minwoo/project/FANS

echo "🐳 Docker 컨테이너 시작 중..."
docker compose up -d

echo ""
echo "✅ 서비스 시작 완료!"
echo ""
echo "📊 컨테이너 상태 확인:"
docker compose ps

echo ""
echo "🌐 접속 URL:"
echo "  - 프론트엔드: http://localhost:3001"
echo "  - 메인 API: http://localhost:3000"
echo "  - AI 서비스: http://localhost:8000"
echo "  - 데이터베이스: localhost:5432"