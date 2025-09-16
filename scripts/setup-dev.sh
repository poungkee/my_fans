#!/bin/bash

# FANS 프로젝트 개발 환경 설정 스크립트
echo "🚀 FANS 프로젝트 개발 환경 설정을 시작합니다..."

# 현재 디렉토리 확인
if [ ! -f ".nvmrc" ]; then
    echo "❌ FANS 프로젝트 루트 디렉토리에서 실행해주세요"
    exit 1
fi

# Node.js 버전 확인 및 설정
echo "📦 Node.js 버전 확인 중..."
if command -v nvm &> /dev/null; then
    echo "✅ nvm 발견됨"
    nvm use
    if [ $? -ne 0 ]; then
        echo "📥 Node.js $(cat .nvmrc) 설치 중..."
        nvm install $(cat .nvmrc)
        nvm use
    fi
else
    echo "⚠️  nvm이 설치되지 않았습니다. Node.js $(cat .nvmrc) 이상이 필요합니다."
    node_version=$(node --version 2>/dev/null | sed 's/v//')
    required_version=$(cat .nvmrc)
    if [ -z "$node_version" ]; then
        echo "❌ Node.js가 설치되지 않았습니다."
        exit 1
    fi
fi

# Python 버전 확인
echo "🐍 Python 버전 확인 중..."
python_version=$(python3 --version 2>/dev/null | awk '{print $2}')
if [ -z "$python_version" ]; then
    echo "❌ Python3가 설치되지 않았습니다."
    echo "Ubuntu: sudo apt install python3 python3-pip python3-venv"
    echo "macOS: brew install python3"
    exit 1
fi
echo "✅ Python $python_version 발견됨"

# Docker 확인
echo "🐳 Docker 확인 중..."
if command -v docker &> /dev/null; then
    echo "✅ Docker 발견됨"
    docker --version
else
    echo "⚠️  Docker가 설치되지 않았습니다. PostgreSQL 실행을 위해 필요합니다."
fi

# Backend API 설정
echo "🔧 Backend API 환경 설정 중..."
cd backend/api
if [ ! -f "package.json" ]; then
    echo "❌ backend/api/package.json을 찾을 수 없습니다."
    cd ../..
    exit 1
fi

echo "📦 NPM 패키지 설치 중..."
npm install
if [ $? -eq 0 ]; then
    echo "✅ Backend API 패키지 설치 완료"
else
    echo "❌ Backend API 패키지 설치 실패"
    cd ../..
    exit 1
fi
cd ../..

# Frontend 설정
echo "🎨 Frontend 환경 설정 중..."
cd frontend
if [ ! -f "package.json" ]; then
    echo "❌ frontend/package.json을 찾을 수 없습니다."
    cd ..
    exit 1
fi

echo "📦 NPM 패키지 설치 중..."
npm install
if [ $? -eq 0 ]; then
    echo "✅ Frontend 패키지 설치 완료"
else
    echo "❌ Frontend 패키지 설치 실패"
    cd ..
    exit 1
fi
cd ..

# Python AI Service 설정
echo "🤖 AI Service 환경 설정 중..."
cd backend/ai-service
if [ ! -f "requirements.txt" ]; then
    echo "❌ backend/ai-service/requirements.txt를 찾을 수 없습니다."
    cd ../..
    exit 1
fi

echo "🐍 Python 가상환경 생성 중..."
python3 -m venv venv
if [ $? -eq 0 ]; then
    echo "✅ 가상환경 생성 완료"
else
    echo "❌ 가상환경 생성 실패"
    cd ../..
    exit 1
fi

echo "📦 Python 패키지 설치 중..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
if [ $? -eq 0 ]; then
    echo "✅ AI Service 패키지 설치 완료"
    deactivate
else
    echo "❌ AI Service 패키지 설치 실패"
    deactivate
    cd ../..
    exit 1
fi
cd ../..

# 환경변수 파일 확인
echo "🔐 환경변수 파일 확인 중..."
env_files=("backend/api/.env" "backend/ai-service/.env")
missing_env=false

for env_file in "${env_files[@]}"; do
    if [ ! -f "$env_file" ]; then
        echo "⚠️  $env_file 파일이 없습니다."
        missing_env=true
    else
        echo "✅ $env_file 확인됨"
    fi
done

if [ "$missing_env" = true ]; then
    echo "📝 환경변수 파일을 생성해주세요. 예시:"
    echo "  backend/api/.env - DB 연결 정보, API 키 등"
    echo "  backend/ai-service/.env - AI 모델 설정 등"
fi

# Docker PostgreSQL 시작 안내
echo ""
echo "🎯 다음 단계:"
echo "1. PostgreSQL 시작: docker run -d --name fans-postgres -e POSTGRES_DB=fans_db -e POSTGRES_USER=fans_user -e POSTGRES_PASSWORD=fans_password -p 5432:5432 postgres:15"
echo "2. Backend API 실행: cd backend/api && npm run dev"
echo "3. AI Service 실행: cd backend/ai-service && source venv/bin/activate && uvicorn app.main:app --reload --port 8000"
echo "4. Frontend 실행: cd frontend && npm start"

echo ""
echo "🎉 개발 환경 설정이 완료되었습니다!"