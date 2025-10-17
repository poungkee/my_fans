# ========================================
# FANS Terraform Deployment Script
# Run in PowerShell
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FANS EKS Infrastructure Deployment" -ForegroundColor Cyan
Write-Host "Estimated Time: 30 minutes" -ForegroundColor Cyan
Write-Host "Estimated Cost: $105/month" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check current directory
$currentDir = Get-Location
Write-Host "Current Directory: $currentDir" -ForegroundColor Yellow
Write-Host ""

# Check Terraform installation
Write-Host "[1/4] Checking Terraform..." -ForegroundColor Green
try {
    $terraformVersion = terraform version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK - Terraform installed" -ForegroundColor Green
    } else {
        Write-Host "ERROR - Terraform not found!" -ForegroundColor Red
        Write-Host "Download: https://www.terraform.io/downloads" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "ERROR - Terraform not found!" -ForegroundColor Red
    Write-Host "Download: https://www.terraform.io/downloads" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Check AWS credentials
Write-Host "[2/4] Checking AWS credentials..." -ForegroundColor Green
try {
    $awsIdentity = aws sts get-caller-identity 2>&1 | ConvertFrom-Json
    Write-Host "OK - AWS connected" -ForegroundColor Green
    Write-Host "  Account: $($awsIdentity.Account)" -ForegroundColor White
    Write-Host "  User: $($awsIdentity.Arn.Split('/')[-1])" -ForegroundColor White
} catch {
    Write-Host "ERROR - AWS credentials failed!" -ForegroundColor Red
    Write-Host "Run: aws configure" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Terraform init
Write-Host "[3/4] Initializing Terraform..." -ForegroundColor Green
terraform init
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR - Terraform init failed!" -ForegroundColor Red
    exit 1
}
Write-Host "OK - Terraform initialized" -ForegroundColor Green
Write-Host ""

# Terraform plan
Write-Host "[4/4] Creating Terraform plan..." -ForegroundColor Green
Write-Host "Checking resources to be created..." -ForegroundColor Yellow
Write-Host ""

terraform plan `
    -var-file="terraform-minimal.tfvars" `
    -var-file="secret.tfvars" `
    -out=tfplan

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR - Terraform plan failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Plan Review Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Resources to be created:" -ForegroundColor Yellow
Write-Host "  - EKS Cluster (monthly: `$73)" -ForegroundColor White
Write-Host "  - Spot Instances x2 (monthly: `$18)" -ForegroundColor White
Write-Host "  - RDS PostgreSQL (monthly: `$15)" -ForegroundColor White
Write-Host "  - NAT Gateway (monthly: `$16)" -ForegroundColor White
Write-Host "  - NLB (monthly: `$16)" -ForegroundColor White
Write-Host "  - ECR Repositories x7" -ForegroundColor White
Write-Host ""
Write-Host "Total Monthly Cost: `$105" -ForegroundColor Green
Write-Host ""

# User confirmation
$confirmation = Read-Host "Do you want to create these resources? (yes/no)"
if ($confirmation -ne "yes") {
    Write-Host "Deployment cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Applying Terraform!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Terraform apply
terraform apply tfplan

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR - Deployment failed!" -ForegroundColor Red
    Write-Host "Check logs and fix issues." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Show outputs
Write-Host "Created Resources:" -ForegroundColor Cyan
terraform output

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Configure kubectl:" -ForegroundColor White
Write-Host "   aws eks update-kubeconfig --name dw-fans-prod-eks --region ap-northeast-2" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Build and push Docker images" -ForegroundColor White
Write-Host "   (See deployment guide)" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Deploy Kubernetes resources" -ForegroundColor White
Write-Host "   kubectl apply -f ../../kubernetes/minimal/" -ForegroundColor Gray
Write-Host ""
Write-Host "Guide: D:\dev1\DEPLOYMENT_GUIDE_MINIMAL.md" -ForegroundColor Cyan
Write-Host ""
