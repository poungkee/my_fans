#!/bin/zsh

# FANS 프로젝트 개발 환경 설정 스크립트 (macOS)
echo "🚀 FANS 프로젝트 개발 환경 설정을 시작합니다... (macOS)"

# 현재 디렉토리 확인
if [ ! -f ".nvmrc" ]; then
    echo "❌ FANS 프로젝트 루트 디렉토리에서 실행해주세요"
    exit 1
fi

# Homebrew 확인
echo "🍺 Homebrew 확인 중..."
if command -v brew &> /dev/null; then
    echo "✅ Homebrew 발견됨"
else
    echo "⚠️  Homebrew가 설치되지 않았습니다. 설치를 권장합니다."
    echo "설치 명령어: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
fi

# Node.js 버전 확인 및 설정
echo "📦 Node.js 버전 확인 중..."

# nvm 확인 (여러 경로에서)
NVM_PATHS=(
    "$HOME/.nvm/nvm.sh"
    "/usr/local/opt/nvm/nvm.sh"
    "/opt/homebrew/opt/nvm/nvm.sh"
    "$(brew --prefix nvm 2>/dev/null)/nvm.sh"
)

nvm_found=false
for nvm_path in "${NVM_PATHS[@]}"; do
    if [ -f "$nvm_path" ]; then
        echo "✅ nvm 발견됨: $nvm_path"
        source "$nvm_path"
        nvm_found=true
        break
    fi
done

if [ "$nvm_found" = true ]; then
    required_version=$(cat .nvmrc)
    current_version=$(nvm current 2>/dev/null)
    
    echo "필요 버전: $required_version"
    echo "현재 버전: $current_version"
    
    nvm use "$required_version" 2>/dev/null
    if [ $? -ne 0 ]; then
        echo "📥 Node.js $required_version 설치 중..."
        nvm install "$required_version"
        nvm use "$required_version"
        nvm alias default "$required_version"
    fi
else
    echo "⚠️  nvm이 설치되지 않았습니다."
    
    # Node.js 직접 확인
    if command -v node &> /dev/null; then
        node_version=$(node --version)
        echo "✅ Node.js $node_version 발견됨"
        
        required_version=$(cat .nvmrc)
        echo "⚠️  Node.js $required_version 이상이 필요합니다."
    else
        echo "❌ Node.js가 설치되지 않았습니다."
        echo "Homebrew 설치 후: brew install nvm"
        echo "또는 직접 설치: https://nodejs.org"
        exit 1
    fi
fi

# Python 버전 확인
echo "🐍 Python 버전 확인 중..."
python_cmd=""

for cmd in python3 python; do
    if command -v $cmd &> /dev/null; then
        python_version=$($cmd --version 2>&1)
        echo "✅ Python $python_version 발견됨 (명령어: $cmd)"
        python_cmd=$cmd
        break
    fi
done

if [ -z "$python_cmd" ]; then
    echo "❌ Python이 설치되지 않았습니다."
    echo "Homebrew 설치: brew install python3"
    echo "또는 직접 설치: https://python.org"
    exit 1
fi

# Docker 확인
echo "🐳 Docker 확인 중..."
if command -v docker &> /dev/null; then
    docker_version=$(docker --version)
    echo "✅ Docker 발견됨: $docker_version"
else
    echo "⚠️  Docker가 설치되지 않았습니다. PostgreSQL 실행을 위해 필요합니다."
    echo "Homebrew 설치: brew install --cask docker"
    echo "또는 직접 설치: https://docker.com/products/docker-desktop"
fi

# Xcode Command Line Tools 확인 (컴파일 필요한 패키지용)
echo "🔧 Xcode Command Line Tools 확인 중..."
if xcode-select -p &> /dev/null; then
    echo "✅ Xcode Command Line Tools 설치됨"
else
    echo "⚠️  Xcode Command Line Tools가 필요할 수 있습니다."
    echo "설치 명령어: xcode-select --install"
fi

# Backend API 설정
echo "🔧 Backend API 환경 설정 중..."
cd backend/api || { echo "❌ backend/api 디렉토리를 찾을 수 없습니다."; exit 1; }

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
cd frontend || { echo "❌ frontend 디렉토리를 찾을 수 없습니다."; exit 1; }

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
cd backend/ai-service || { echo "❌ backend/ai-service 디렉토리를 찾을 수 없습니다."; exit 1; }

if [ ! -f "requirements.txt" ]; then
    echo "❌ backend/ai-service/requirements.txt를 찾을 수 없습니다."
    cd ../..
    exit 1
fi

echo "🐍 Python 가상환경 생성 중..."
$python_cmd -m venv venv
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

# 다음 단계 안내
echo ""
echo "🎯 다음 단계:"
echo "1. PostgreSQL 시작: docker run -d --name fans-postgres -e POSTGRES_DB=fans_db -e POSTGRES_USER=fans_user -e POSTGRES_PASSWORD=fans_password -p 5432:5432 postgres:15"
echo "2. Backend API 실행: cd backend/api && npm run dev"
echo "3. AI Service 실행: cd backend/ai-service && source venv/bin/activate && uvicorn app.main:app --reload --port 8000"
echo "4. Frontend 실행: cd frontend && npm start"

echo ""
echo "💡 macOS 팁:"
echo "- Homebrew로 패키지 관리: brew install nvm python3 docker"
echo "- Docker Desktop 앱을 먼저 실행해주세요"
echo "- 터미널 재시작 후 nvm 명령어 사용 가능"

echo ""
echo "🎉 개발 환경 설정이 완료되었습니다!"