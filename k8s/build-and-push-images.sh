#!/bin/bash
# Docker 이미지 빌드 및 ECR 푸시 스크립트

set -e

export AWS_REGION="ap-northeast-2"
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
export ECR_PREFIX="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/fans"

echo "=========================================="
echo "Building and Pushing Docker Images"
echo "=========================================="
echo "AWS Account: $AWS_ACCOUNT_ID"
echo "Region: $AWS_REGION"
echo "ECR Prefix: $ECR_PREFIX"
echo "=========================================="

# ECR 로그인
echo ""
echo "Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
echo "✅ Logged in to ECR"

# 이미지 빌드 및 푸시
echo ""
echo "Building and pushing images..."

# 1. Main API
echo ""
echo "[1/7] Main API..."
docker build -t fans-main-api -f backend/api/Dockerfile backend/api
docker tag fans-main-api:latest $ECR_PREFIX-main-api:latest
docker tag fans-main-api:latest $ECR_PREFIX-main-api:$(date +%Y%m%d-%H%M%S)
docker push $ECR_PREFIX-main-api:latest
docker push $ECR_PREFIX-main-api:$(date +%Y%m%d-%H%M%S)
echo "✅ Main API pushed"

# 2. Frontend
echo ""
echo "[2/7] Frontend..."
docker build -t fans-frontend -f frontend/Dockerfile frontend
docker tag fans-frontend:latest $ECR_PREFIX-frontend:latest
docker tag fans-frontend:latest $ECR_PREFIX-frontend:$(date +%Y%m%d-%H%M%S)
docker push $ECR_PREFIX-frontend:latest
docker push $ECR_PREFIX-frontend:$(date +%Y%m%d-%H%M%S)
echo "✅ Frontend pushed"

# 3. API Crawler
echo ""
echo "[3/7] API Crawler..."
docker build -t fans-api-crawler -f backend/crawler/Dockerfile backend/crawler
docker tag fans-api-crawler:latest $ECR_PREFIX-api-crawler:latest
docker tag fans-api-crawler:latest $ECR_PREFIX-api-crawler:$(date +%Y%m%d-%H%M%S)
docker push $ECR_PREFIX-api-crawler:latest
docker push $ECR_PREFIX-api-crawler:$(date +%Y%m%d-%H%M%S)
echo "✅ API Crawler pushed"

# 4. Classification API
echo ""
echo "[4/7] Classification API..."
docker build -t fans-classification-api -f backend/simple-classifier/Dockerfile backend/simple-classifier
docker tag fans-classification-api:latest $ECR_PREFIX-classification-api:latest
docker tag fans-classification-api:latest $ECR_PREFIX-classification-api:$(date +%Y%m%d-%H%M%S)
docker push $ECR_PREFIX-classification-api:latest
docker push $ECR_PREFIX-classification-api:$(date +%Y%m%d-%H%M%S)
echo "✅ Classification API pushed"

# 5. Summarize AI
echo ""
echo "[5/7] Summarize AI..."
docker build -t fans-summarize-ai -f backend/ai/summarize-ai/Dockerfile backend/ai/summarize-ai
docker tag fans-summarize-ai:latest $ECR_PREFIX-summarize-ai:latest
docker tag fans-summarize-ai:latest $ECR_PREFIX-summarize-ai:$(date +%Y%m%d-%H%M%S)
docker push $ECR_PREFIX-summarize-ai:latest
docker push $ECR_PREFIX-summarize-ai:$(date +%Y%m%d-%H%M%S)
echo "✅ Summarize AI pushed"

# 6. Bias Analysis AI
echo ""
echo "[6/7] Bias Analysis AI..."
docker build -t fans-bias-analysis-ai -f backend/ai/bias-analysis-ai/Dockerfile backend/ai/bias-analysis-ai
docker tag fans-bias-analysis-ai:latest $ECR_PREFIX-bias-analysis-ai:latest
docker tag fans-bias-analysis-ai:latest $ECR_PREFIX-bias-analysis-ai:$(date +%Y%m%d-%H%M%S)
docker push $ECR_PREFIX-bias-analysis-ai:latest
docker push $ECR_PREFIX-bias-analysis-ai:$(date +%Y%m%d-%H%M%S)
echo "✅ Bias Analysis AI pushed"

# 7. Scheduler
echo ""
echo "[7/7] Scheduler..."
docker build -t fans-scheduler -f backend/scheduler/Dockerfile backend/scheduler
docker tag fans-scheduler:latest $ECR_PREFIX-scheduler:latest
docker tag fans-scheduler:latest $ECR_PREFIX-scheduler:$(date +%Y%m%d-%H%M%S)
docker push $ECR_PREFIX-scheduler:latest
docker push $ECR_PREFIX-scheduler:$(date +%Y%m%d-%H%M%S)
echo "✅ Scheduler pushed"

echo ""
echo "=========================================="
echo "✅ All images built and pushed!"
echo "=========================================="
