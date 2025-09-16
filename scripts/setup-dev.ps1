# FANS Project Development Environment Setup Script (Windows PowerShell)
Write-Host "Starting FANS project development environment setup... (Windows)" -ForegroundColor Green

# Check if running in FANS project root
if (-not (Test-Path ".nvmrc")) {
    Write-Host "ERROR: Please run this script from FANS project root directory" -ForegroundColor Red
    exit 1
}

# Check Node.js version
Write-Host "Checking Node.js version..." -ForegroundColor Yellow

$nvmPath = "$env:NVM_HOME\nvm.exe"
if (Test-Path $nvmPath) {
    Write-Host "SUCCESS: nvm-windows found" -ForegroundColor Green
    $requiredVersion = Get-Content ".nvmrc"
    
    & $nvmPath use $requiredVersion 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Installing Node.js $requiredVersion..." -ForegroundColor Yellow
        & $nvmPath install $requiredVersion
        & $nvmPath use $requiredVersion
    }
} else {
    Write-Host "WARNING: nvm-windows not installed" -ForegroundColor Yellow
    
    $nodeVersion = $null
    try {
        $nodeVersion = & node --version 2>$null
    } catch {
        # Command execution failed
    }
    
    if ($nodeVersion) {
        Write-Host "SUCCESS: Node.js $nodeVersion found" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Node.js not installed" -ForegroundColor Red
        Write-Host "Please install from: https://nodejs.org" -ForegroundColor Yellow
        exit 1
    }
}

# Check Python version
Write-Host "Checking Python version..." -ForegroundColor Yellow

$pythonCmd = $null
$pythonCommands = @("python", "python3", "py")

foreach ($cmd in $pythonCommands) {
    try {
        $version = & $cmd --version 2>$null
        if ($version) {
            $pythonCmd = $cmd
            Write-Host "SUCCESS: Python $version found (command: $cmd)" -ForegroundColor Green
            break
        }
    } catch {
        # Command not found
    }
}

if (-not $pythonCmd) {
    Write-Host "ERROR: Python not installed" -ForegroundColor Red
    Write-Host "Please install from: https://python.org" -ForegroundColor Yellow
    Write-Host "Make sure to check 'Add Python to PATH' during installation" -ForegroundColor Yellow
    exit 1
}

# Check Docker
Write-Host "Checking Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = & docker --version 2>$null
    if ($dockerVersion) {
        Write-Host "SUCCESS: Docker found: $dockerVersion" -ForegroundColor Green
    }
} catch {
    Write-Host "WARNING: Docker not installed" -ForegroundColor Yellow
    Write-Host "Docker is needed for PostgreSQL database" -ForegroundColor Yellow
}

# Setup Backend API
Write-Host "Setting up Backend API..." -ForegroundColor Yellow
Set-Location "backend\api"

if (-not (Test-Path "package.json")) {
    Write-Host "ERROR: backend\api\package.json not found" -ForegroundColor Red
    Set-Location "..\.."; exit 1
}

Write-Host "Installing NPM packages..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS: Backend API packages installed" -ForegroundColor Green
} else {
    Write-Host "ERROR: Backend API package installation failed" -ForegroundColor Red
    Set-Location "..\.."; exit 1
}
Set-Location "..\..\"

# Setup Frontend
Write-Host "Setting up Frontend..." -ForegroundColor Yellow
Set-Location "frontend"

if (-not (Test-Path "package.json")) {
    Write-Host "ERROR: frontend\package.json not found" -ForegroundColor Red
    Set-Location ".."; exit 1
}

Write-Host "Installing NPM packages..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS: Frontend packages installed" -ForegroundColor Green
} else {
    Write-Host "ERROR: Frontend package installation failed" -ForegroundColor Red
    Set-Location ".."; exit 1
}
Set-Location ".."

# Setup Python AI Service
Write-Host "Setting up AI Service..." -ForegroundColor Yellow
Set-Location "backend\ai-service"

if (-not (Test-Path "requirements.txt")) {
    Write-Host "ERROR: backend\ai-service\requirements.txt not found" -ForegroundColor Red
    Set-Location "..\.."; exit 1
}

Write-Host "Creating Python virtual environment..." -ForegroundColor Yellow
& $pythonCmd -m venv venv
if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS: Virtual environment created" -ForegroundColor Green
} else {
    Write-Host "ERROR: Virtual environment creation failed" -ForegroundColor Red
    Set-Location "..\.."; exit 1
}

Write-Host "Installing Python packages..." -ForegroundColor Yellow
& "venv\Scripts\Activate.ps1"
pip install --upgrade pip
pip install -r requirements.txt
if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS: AI Service packages installed" -ForegroundColor Green
} else {
    Write-Host "ERROR: AI Service package installation failed" -ForegroundColor Red
}
deactivate
Set-Location "..\..\"

# Check environment files
Write-Host "Checking environment files..." -ForegroundColor Yellow
$envFiles = @("backend\api\.env", "backend\ai-service\.env")
$missingEnv = $false

foreach ($envFile in $envFiles) {
    if (-not (Test-Path $envFile)) {
        Write-Host "WARNING: $envFile file missing" -ForegroundColor Yellow
        $missingEnv = $true
    } else {
        Write-Host "SUCCESS: $envFile found" -ForegroundColor Green
    }
}

if ($missingEnv) {
    Write-Host "NOTE: Please create environment variable files" -ForegroundColor Yellow
}

# Next steps
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Cyan
Write-Host "1. Start PostgreSQL: docker run -d --name fans-postgres -e POSTGRES_DB=fans_db -e POSTGRES_USER=fans_user -e POSTGRES_PASSWORD=fans_password -p 5432:5432 postgres:15" -ForegroundColor Gray
Write-Host "2. Start Backend API: cd backend\api; npm run dev" -ForegroundColor Gray
Write-Host "3. Start AI Service: cd backend\ai-service; .\venv\Scripts\Activate; uvicorn app.main:app --reload --port 8000" -ForegroundColor Gray
Write-Host "4. Start Frontend: cd frontend; npm start" -ForegroundColor Gray

Write-Host ""
Write-Host "COMPLETED: Development environment setup finished!" -ForegroundColor Green