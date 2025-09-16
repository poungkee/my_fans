# FANS 프로젝트 개발 환경 설정 스크립트 (Windows PowerShell)
Write-Host "🚀 FANS 프로젝트 개발 환경 설정을 시작합니다... (Windows)" -ForegroundColor Green

# 현재 디렉토리 확인
if (-not (Test-Path ".nvmrc")) {
    Write-Host "❌ FANS 프로젝트 루트 디렉토리에서 실행해주세요" -ForegroundColor Red
    exit 1
}

# Node.js 버전 확인 및 설정
Write-Host "📦 Node.js 버전 확인 중..." -ForegroundColor Yellow

# nvm-windows 확인
$nvmPath = "$env:NVM_HOME\nvm.exe"
if (Test-Path $nvmPath) {
    Write-Host "✅ nvm-windows 발견됨" -ForegroundColor Green
    $requiredVersion = Get-Content ".nvmrc"
    
    try {
        & $nvmPath use $requiredVersion
        if ($LASTEXITCODE -ne 0) {
            Write-Host "📥 Node.js $requiredVersion 설치 중..." -ForegroundColor Yellow
            & $nvmPath install $requiredVersion
            & $nvmPath use $requiredVersion
        }
    }
    catch {
        Write-Host "⚠️  nvm 명령 실행 실패: $_" -ForegroundColor Yellow
    }
}
else {
    Write-Host "⚠️  nvm-windows가 설치되지 않았습니다. Node.js $((Get-Content '.nvmrc')) 이상이 필요합니다." -ForegroundColor Yellow
    
    # Node.js 직접 확인
    $nodeVersion = $null
    try {
        $nodeVersion = & node --version 2>$null
    }
    catch {
        # 명령어 실행 실패
    }
    
    if ($nodeVersion) {
        Write-Host "✅ Node.js $nodeVersion 발견됨" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Node.js가 설치되지 않았습니다." -ForegroundColor Red
        Write-Host "다음 링크에서 설치해주세요: https://nodejs.org" -ForegroundColor Yellow
        exit 1
    }
}

# Python 버전 확인
Write-Host "🐍 Python 버전 확인 중..." -ForegroundColor Yellow

$pythonCmd = $null
@("python", "python3", "py") | ForEach-Object {
    try {
        $version = & $_ --version 2>$null
        if ($version) {
            $pythonCmd = $_
            Write-Host "✅ Python $version 발견됨 (명령어: $_)" -ForegroundColor Green
            return
        }
    }
    catch { }
}

if (-not $pythonCmd) {
    Write-Host "❌ Python이 설치되지 않았습니다." -ForegroundColor Red
    Write-Host "다음 링크에서 설치해주세요: https://python.org" -ForegroundColor Yellow
    exit 1
}

# Docker 확인
Write-Host "🐳 Docker 확인 중..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>$null
    if ($dockerVersion) {
        Write-Host "✅ Docker 발견됨: $dockerVersion" -ForegroundColor Green
    }
}
catch {
    Write-Host "⚠️  Docker가 설치되지 않았습니다. PostgreSQL 실행을 위해 필요합니다." -ForegroundColor Yellow
    Write-Host "다음 링크에서 설치해주세요: https://docker.com" -ForegroundColor Yellow
}

# Backend API 설정
Write-Host "🔧 Backend API 환경 설정 중..." -ForegroundColor Yellow
Set-Location "backend\api"

if (-not (Test-Path "package.json")) {
    Write-Host "❌ backend\api\package.json을 찾을 수 없습니다." -ForegroundColor Red
    Set-Location "..\.."; exit 1
}

Write-Host "📦 NPM 패키지 설치 중..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backend API 패키지 설치 완료" -ForegroundColor Green
}
else {
    Write-Host "❌ Backend API 패키지 설치 실패" -ForegroundColor Red
    Set-Location "..\.."; exit 1
}
Set-Location "..\..\"

# Frontend 설정
Write-Host "🎨 Frontend 환경 설정 중..." -ForegroundColor Yellow
Set-Location "frontend"

if (-not (Test-Path "package.json")) {
    Write-Host "❌ frontend\package.json을 찾을 수 없습니다." -ForegroundColor Red
    Set-Location ".."; exit 1
}

Write-Host "📦 NPM 패키지 설치 중..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Frontend 패키지 설치 완료" -ForegroundColor Green
}
else {
    Write-Host "❌ Frontend 패키지 설치 실패" -ForegroundColor Red
    Set-Location ".."; exit 1
}
Set-Location ".."

# Python AI Service 설정
Write-Host "🤖 AI Service 환경 설정 중..." -ForegroundColor Yellow
Set-Location "backend\ai-service"

if (-not (Test-Path "requirements.txt")) {
    Write-Host "❌ backend\ai-service\requirements.txt를 찾을 수 없습니다." -ForegroundColor Red
    Set-Location "..\.."; exit 1
}

Write-Host "🐍 Python 가상환경 생성 중..." -ForegroundColor Yellow
& $pythonCmd -m venv venv
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 가상환경 생성 완료" -ForegroundColor Green
}
else {
    Write-Host "❌ 가상환경 생성 실패" -ForegroundColor Red
    Set-Location "..\.."; exit 1
}

Write-Host "📦 Python 패키지 설치 중..." -ForegroundColor Yellow
& "venv\Scripts\Activate.ps1"
pip install --upgrade pip
pip install -r requirements.txt
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ AI Service 패키지 설치 완료" -ForegroundColor Green
    deactivate
}
else {
    Write-Host "❌ AI Service 패키지 설치 실패" -ForegroundColor Red
    deactivate
    Set-Location "..\.."; exit 1
}
Set-Location "..\..\"

# 환경변수 파일 확인
Write-Host "🔐 환경변수 파일 확인 중..." -ForegroundColor Yellow
$envFiles = @("backend\api\.env", "backend\ai-service\.env")
$missingEnv = $false

foreach ($envFile in $envFiles) {
    if (-not (Test-Path $envFile)) {
        Write-Host "⚠️  $envFile 파일이 없습니다." -ForegroundColor Yellow
        $missingEnv = $true
    }
    else {
        Write-Host "✅ $envFile 확인됨" -ForegroundColor Green
    }
}

if ($missingEnv) {
    Write-Host "📝 환경변수 파일을 생성해주세요. 예시:" -ForegroundColor Yellow
    Write-Host "  backend\api\.env - DB 연결 정보, API 키 등" -ForegroundColor Gray
    Write-Host "  backend\ai-service\.env - AI 모델 설정 등" -ForegroundColor Gray
}

# 다음 단계 안내
Write-Host ""
Write-Host "🎯 다음 단계:" -ForegroundColor Cyan
Write-Host "1. PostgreSQL 시작: docker run -d --name fans-postgres -e POSTGRES_DB=fans_db -e POSTGRES_USER=fans_user -e POSTGRES_PASSWORD=fans_password -p 5432:5432 postgres:15" -ForegroundColor Gray
Write-Host "2. Backend API 실행: cd backend\api; npm run dev" -ForegroundColor Gray
Write-Host "3. AI Service 실행: cd backend\ai-service; .\venv\Scripts\Activate; python -m uvicorn app.main:app --reload --port 8000" -ForegroundColor Gray
Write-Host "4. Frontend 실행: cd frontend; npm start" -ForegroundColor Gray

Write-Host ""
Write-Host "🎉 개발 환경 설정이 완료되었습니다!" -ForegroundColor Green