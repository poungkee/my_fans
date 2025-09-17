#!/bin/bash

# FANS 프로젝트 모든 서비스 강제 종료 스크립트
echo "🛑 FANS 프로젝트 모든 서비스를 강제 종료합니다..."

# Node.js 프로세스 종료
echo "🔧 Backend API 및 Frontend 종료 중..."
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "npm start" 2>/dev/null || true
pkill -f "node.*app.ts" 2>/dev/null || true
pkill -f "ts-node-dev" 2>/dev/null || true

# Python/uvicorn 프로세스 종료
echo "🤖 AI Service 종료 중..."
pkill -f "uvicorn" 2>/dev/null || true
pkill -f "main:app" 2>/dev/null || true

# 포트 기반으로 강제 종료
echo "🔌 포트별 프로세스 강제 종료 중..."
sudo lsof -ti:3000 | xargs -r sudo kill -9 2>/dev/null || true
sudo lsof -ti:3001 | xargs -r sudo kill -9 2>/dev/null || true
sudo lsof -ti:8000 | xargs -r sudo kill -9 2>/dev/null || true

echo "✅ 모든 서비스가 종료되었습니다"
echo ""
echo "📊 포트 상태 확인:"
echo "   포트 3000 (Backend): $(lsof -ti:3000 | wc -l) 프로세스"
echo "   포트 3001 (Frontend): $(lsof -ti:3001 | wc -l) 프로세스"
echo "   포트 8000 (AI): $(lsof -ti:8000 | wc -l) 프로세스"