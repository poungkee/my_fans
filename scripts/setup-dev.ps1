# FANS Project Development Environment Setup Script (Windows PowerShell)
Write-Host "🚀 Starting FANS project development environment setup... (Windows)" -ForegroundColor Green

# Check if running in FANS project root
if (-not (Test-Path ".nvmrc")) {
    Write-Host "❌ Please run this script from FANS project root directory" -ForegroundColor Red
    exit 1
}

# Check Node.js version
Write-Host "📦 Checking Node.js version..." -ForegroundColor Yellow

$nvmPath = "$env:NVM_HOME\nvm.exe"
if (Test-Path $nvmPath) {
    Write-Host "✅ nvm-windows found" -ForegroundColor Green
    $requiredVersion = Get-Content ".nvmrc"
    
    & $nvmPath use $requiredVersion 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "📥 Installing Node.js $requiredVersion..." -ForegroundColor Yellow
        & $nvmPath install $requiredVersion
        & $nvmPath use $requiredVersion
    }
} else {
    Write-Host "⚠️  nvm-windows not installed" -ForegroundColor Yellow
    
    $nodeVersion = $null
    try {
        $nodeVersion = & node --version 2>$null
    } catch {
        # Command execution failed
    }
    
    if ($nodeVersion) {
        Write-Host "✅ Node.js $nodeVersion found" -ForegroundColor Green
    } else {
        Write-Host "❌ Node.js not installed" -ForegroundColor Red
        Write-Host "Please install from: https://nodejs.org" -ForegroundColor Yellow
        exit 1
    }
}

# Check Python version
Write-Host "🐍 Checking Python version..." -ForegroundColor Yellow

$pythonCmd = $null
$pythonCommands = @("python", "python3", "py")

foreach ($cmd in $pythonCommands) {
    try {
        $version = & $cmd --version 2>$null
        if ($version) {
            $pythonCmd = $cmd
            Write-Host "✅ Python $version found (command: $cmd)" -ForegroundColor Green
            break
        }
    } catch {
        # Command not found
    }
}

if (-not $pythonCmd) {
    Write-Host "❌ Python not installed" -ForegroundColor Red
    Write-Host "Please install from: https://python.org" -ForegroundColor Yellow
    exit 1
}

# Check Docker
Write-Host "🐳 Checking Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = & docker --version 2>$null
    if ($dockerVersion) {
        Write-Host "✅ Docker found: $dockerVersion" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Docker not installed" -ForegroundColor Yellow
}

# Setup Backend API
Write-Host "🔧 Setting up Backend API..." -ForegroundColor Yellow
Set-Location "backend\api"

if (-not (Test-Path "package.json")) {
    Write-Host "❌ backend\api\package.json not found" -ForegroundColor Red
    Set-Location "..\.."; exit 1
}

Write-Host "📦 Installing NPM packages..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backend API packages installed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Backend API package installation failed" -ForegroundColor Red
    Set-Location "..\.."; exit 1
}
Set-Location "..\..\"

# Setup Frontend
Write-Host "🎨 Setting up Frontend..." -ForegroundColor Yellow
Set-Location "frontend"

if (-not (Test-Path "package.json")) {
    Write-Host "❌ frontend\package.json not found" -ForegroundColor Red
    Set-Location ".."; exit 1
}

Write-Host "📦 Installing NPM packages..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Frontend packages installed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Frontend package installation failed" -ForegroundColor Red
    Set-Location ".."; exit 1
}
Set-Location ".."

# Setup Python AI Service
Write-Host "🤖 Setting up AI Service..." -ForegroundColor Yellow
Set-Location "backend\ai-service"

if (-not (Test-Path "requirements.txt")) {
    Write-Host "❌ backend\ai-service\requirements.txt not found" -ForegroundColor Red
    Set-Location "..\.."; exit 1
}

Write-Host "🐍 Creating Python virtual environment..." -ForegroundColor Yellow
& $pythonCmd -m venv venv
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Virtual environment created successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Virtual environment creation failed" -ForegroundColor Red
    Set-Location "..\.."; exit 1
}

Write-Host "📦 Installing Python packages..." -ForegroundColor Yellow
& "venv\Scripts\Activate.ps1"
pip install --upgrade pip
pip install -r requirements.txt
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ AI Service packages installed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ AI Service package installation failed" -ForegroundColor Red
}
deactivate
Set-Location "..\..\"

# Check environment files
Write-Host "🔐 Checking environment files..." -ForegroundColor Yellow
$envFiles = @("backend\api\.env", "backend\ai-service\.env")
$missingEnv = $false

foreach ($envFile in $envFiles) {
    if (-not (Test-Path $envFile)) {
        Write-Host "⚠️  $envFile file missing" -ForegroundColor Yellow
        $missingEnv = $true
    } else {
        Write-Host "✅ $envFile found" -ForegroundColor Green
    }
}

if ($missingEnv) {
    Write-Host "📝 Please create environment variable files" -ForegroundColor Yellow
}

# Next steps
Write-Host ""
Write-Host "🎯 Next steps:" -ForegroundColor Cyan
Write-Host "1. Start PostgreSQL: docker run -d --name fans-postgres -e POSTGRES_DB=fans_db -e POSTGRES_USER=fans_user -e POSTGRES_PASSWORD=fans_password -p 5432:5432 postgres:15" -ForegroundColor Gray
Write-Host "2. Start Backend API: cd backend\api; npm run dev" -ForegroundColor Gray
Write-Host "3. Start AI Service: cd backend\ai-service; .\venv\Scripts\Activate; uvicorn app.main:app --reload --port 8000" -ForegroundColor Gray
Write-Host "4. Start Frontend: cd frontend; npm start" -ForegroundColor Gray

Write-Host ""
Write-Host "🎉 Development environment setup completed!" -ForegroundColor Green