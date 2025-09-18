#!/bin/bash

# FANS 프로젝트 전체 서비스 시작 스크립트
echo "🚀 FANS 프로젝트 모든 서비스를 시작합니다..."

# 현재 디렉토리 확인
if [ ! -f "package.json" ] && [ ! -f "backend/api/package.json" ]; then
    echo "❌ FANS 프로젝트 루트 디렉토리에서 실행해주세요"
    exit 1
fi

# 로그 파일 디렉토리 생성
mkdir -p logs

# 함수: 서비스 종료
cleanup() {
    echo ""
    echo "🛑 모든 서비스를 종료합니다..."
    kill $BACKEND_PID $AI_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Ctrl+C 시 정리 함수 실행
trap cleanup INT

# 1. Backend API 시작
echo "🔧 Backend API 시작 중..."
cd backend/api
npm run dev > ../../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend API 시작됨 (PID: $BACKEND_PID)"
cd ../..

# 2. AI Service 시작
echo "🤖 AI Service 시작 중..."
cd backend/ai-service
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000 > ../../logs/ai-service.log 2>&1 &
AI_PID=$!
echo "✅ AI Service 시작됨 (PID: $AI_PID)"
cd ../..

# 3. Frontend 시작
echo "🎨 Frontend 시작 중..."
cd frontend
npm start > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ Frontend 시작됨 (PID: $FRONTEND_PID)"
cd ..

# 서비스 상태 확인
sleep 3
echo ""
echo "📊 서비스 상태:"
echo "   Backend API: http://192.168.0.3:3000"
echo "   AI Service:  http://192.168.0.3:8000"
echo "   Frontend:    http://192.168.0.3:3001"
echo ""
echo "📝 로그 파일:"
echo "   Backend:  tail -f logs/backend.log"
echo "   AI:       tail -f logs/ai-service.log"
echo "   Frontend: tail -f logs/frontend.log"
echo ""
echo "🔄 실시간 로그를 보려면 다른 터미널에서 위 명령어를 실행하세요"
echo "⏹️  모든 서비스를 종료하려면 Ctrl+C를 누르세요"
echo ""

# 무한 대기 (서비스들이 계속 실행되도록)
while true; do
    # 프로세스가 살아있는지 확인
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "❌ Backend API가 종료되었습니다"
        cleanup
    fi
    if ! kill -0 $AI_PID 2>/dev/null; then
        echo "❌ AI Service가 종료되었습니다"
        cleanup
    fi
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "❌ Frontend가 종료되었습니다"
        cleanup
    fi
    sleep 5
done