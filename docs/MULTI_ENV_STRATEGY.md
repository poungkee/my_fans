# 멀티 환경 .env 파일 관리 전략

**날짜**: 2025-10-23
**목적**: Local, ECS, EKS 환경별 자동 .env 선택

---

## 🎯 목표

3가지 환경에서 각각 올바른 `.env` 파일을 자동으로 사용:
1. **Local** - Docker Compose 로컬 개발
2. **ECS** - AWS ECS 배포
3. **EKS** - AWS EKS 배포

---

## 📁 파일 구조 (권장)

```
D:\dev1
├── .env.local          # 로컬 개발용 (Docker Compose)
├── .env.ecs            # ECS 배포용
├── .env.eks            # EKS 배포용
├── .env.example        # 템플릿 (Git 커밋용)
├── .env                # 심볼릭 링크 또는 복사본 (Git 제외)
│
├── scripts/
│   ├── load-env.sh     # 환경 자동 선택 스크립트
│   └── switch-env.sh   # 수동 환경 전환 스크립트
│
├── backend/
│   └── api/
│       └── src/
│           └── config/
│               └── env.ts   # 환경변수 로더
│
└── docker-compose.yml
```

---

## 🚀 방법 1: 환경변수 기반 자동 선택 (권장)

### 1.1 환경 감지 스크립트

**`scripts/load-env.sh`** 생성:

```bash
#!/bin/bash
# scripts/load-env.sh
# 환경을 감지하고 적절한 .env 파일을 로드

set -e

# 환경 감지
detect_environment() {
    # ECS 환경 체크
    if [ ! -z "$ECS_CONTAINER_METADATA_URI" ]; then
        echo "ecs"
        return
    fi

    # EKS 환경 체크 (Kubernetes)
    if [ ! -z "$KUBERNETES_SERVICE_HOST" ]; then
        echo "eks"
        return
    fi

    # 명시적 환경변수 체크
    if [ ! -z "$DEPLOY_ENV" ]; then
        echo "$DEPLOY_ENV"
        return
    fi

    # 기본값: 로컬
    echo "local"
}

# 환경 변수 파일 선택
ENV=$(detect_environment)
ENV_FILE=".env.${ENV}"

echo "🔍 감지된 환경: ${ENV}"
echo "📄 사용할 파일: ${ENV_FILE}"

# 파일 존재 확인
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ 오류: ${ENV_FILE} 파일이 없습니다."
    exit 1
fi

# .env로 복사
cp "$ENV_FILE" .env
echo "✅ ${ENV_FILE} → .env 복사 완료"

# 환경변수 내보내기 (선택사항)
export $(grep -v '^#' .env | xargs)
echo "✅ 환경변수 로드 완료"
```

**실행 권한 부여**:
```bash
chmod +x scripts/load-env.sh
```

### 1.2 Docker Compose 통합

**`docker-compose.yml` 수정**:

```yaml
version: '3.8'

services:
  main-api:
    build:
      context: ./backend/api
      dockerfile: Dockerfile
    env_file:
      - .env.${DEPLOY_ENV:-local}  # DEPLOY_ENV 환경변수 사용, 기본값 local
    environment:
      - NODE_ENV=${NODE_ENV:-development}
    # ... 나머지 설정

  summarize-ai:
    build:
      context: ./backend/ai/summarize-ai
    env_file:
      - .env.${DEPLOY_ENV:-local}
    # ... 나머지 설정
```

**실행 방법**:
```bash
# 로컬 환경
docker-compose up -d

# 또는 명시적으로
DEPLOY_ENV=local docker-compose up -d

# ECS 시뮬레이션 (로컬 테스트)
DEPLOY_ENV=ecs docker-compose up -d
```

### 1.3 Node.js에서 자동 로드

**`backend/api/src/config/env.ts`** 생성:

```typescript
import * as dotenv from 'dotenv';
import * as path from 'path';

export function loadEnvironment() {
  // 환경 감지
  const environment = detectEnvironment();

  console.log(`🔍 감지된 환경: ${environment}`);

  // .env 파일 경로 결정
  const envFile = `.env.${environment}`;
  const envPath = path.resolve(__dirname, '../../../', envFile);

  // .env 파일 로드
  const result = dotenv.config({ path: envPath });

  if (result.error) {
    // 기본 .env 파일 시도
    dotenv.config();
    console.warn(`⚠️  ${envFile} 파일을 찾을 수 없어 기본 .env 사용`);
  } else {
    console.log(`✅ ${envFile} 로드 완료`);
  }
}

function detectEnvironment(): string {
  // 1. 명시적 환경변수
  if (process.env.DEPLOY_ENV) {
    return process.env.DEPLOY_ENV;
  }

  // 2. ECS 환경 감지
  if (process.env.ECS_CONTAINER_METADATA_URI) {
    return 'ecs';
  }

  // 3. EKS/Kubernetes 환경 감지
  if (process.env.KUBERNETES_SERVICE_HOST) {
    return 'eks';
  }

  // 4. NODE_ENV 기반
  if (process.env.NODE_ENV === 'production') {
    // 프로덕션이지만 클라우드 환경 아니면 경고
    console.warn('⚠️  NODE_ENV=production이지만 환경을 감지할 수 없습니다.');
  }

  // 5. 기본값: 로컬
  return 'local';
}

export default loadEnvironment;
```

**`backend/api/src/app.ts` 또는 `index.ts`에서 사용**:

```typescript
import loadEnvironment from './config/env';

// 최상단에서 환경 로드
loadEnvironment();

import express from 'express';
// ... 나머지 import

const app = express();
// ... 앱 설정
```

---

## 🚀 방법 2: 환경 전환 스크립트

### 2.1 수동 전환 스크립트

**`scripts/switch-env.sh`** 생성:

```bash
#!/bin/bash
# scripts/switch-env.sh
# 환경을 수동으로 전환

set -e

ENVIRONMENTS=("local" "ecs" "eks")

# 인자 확인
if [ $# -eq 0 ]; then
    echo "사용법: $0 <environment>"
    echo "환경: ${ENVIRONMENTS[@]}"
    exit 1
fi

ENV=$1

# 유효성 검사
if [[ ! " ${ENVIRONMENTS[@]} " =~ " ${ENV} " ]]; then
    echo "❌ 오류: 잘못된 환경입니다. 사용 가능: ${ENVIRONMENTS[@]}"
    exit 1
fi

ENV_FILE=".env.${ENV}"

# 파일 존재 확인
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ 오류: ${ENV_FILE} 파일이 없습니다."
    exit 1
fi

# 백업 (선택사항)
if [ -f ".env" ]; then
    BACKUP_FILE=".env.backup.$(date +%Y%m%d_%H%M%S)"
    cp .env "$BACKUP_FILE"
    echo "📦 기존 .env → ${BACKUP_FILE} 백업 완료"
fi

# .env로 복사
cp "$ENV_FILE" .env
echo "✅ ${ENV_FILE} → .env 복사 완료"
echo "🎯 현재 환경: ${ENV}"
```

**실행 권한 부여**:
```bash
chmod +x scripts/switch-env.sh
```

**사용 방법**:
```bash
# 로컬 환경으로 전환
./scripts/switch-env.sh local

# ECS 환경으로 전환
./scripts/switch-env.sh ecs

# EKS 환경으로 전환
./scripts/switch-env.sh eks
```

### 2.2 npm/yarn 스크립트로 통합

**`package.json`에 추가**:

```json
{
  "scripts": {
    "env:local": "bash scripts/switch-env.sh local",
    "env:ecs": "bash scripts/switch-env.sh ecs",
    "env:eks": "bash scripts/switch-env.sh eks",

    "start:local": "npm run env:local && docker-compose up -d",
    "start:ecs": "npm run env:ecs && docker-compose up -d",
    "start:eks": "npm run env:eks && docker-compose up -d"
  }
}
```

**사용 방법**:
```bash
# 로컬 환경으로 시작
npm run start:local

# ECS 환경으로 시작
npm run start:ecs
```

---

## 🚀 방법 3: Dockerfile 빌드 시점 선택

### 3.1 Multi-stage Build with ARG

**`backend/api/Dockerfile`**:

```dockerfile
# Build stage
FROM node:18-alpine AS builder

# 빌드 인자로 환경 지정
ARG DEPLOY_ENV=local

WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm ci --only=production

# 소스 복사
COPY . .

# 환경별 .env 파일 선택
COPY .env.${DEPLOY_ENV} .env

# TypeScript 빌드
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# 빌드 결과물 복사
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.env ./.env
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

**빌드 방법**:
```bash
# 로컬 환경용 이미지
docker build --build-arg DEPLOY_ENV=local -t fans-api:local .

# ECS 환경용 이미지
docker build --build-arg DEPLOY_ENV=ecs -t fans-api:ecs .

# EKS 환경용 이미지
docker build --build-arg DEPLOY_ENV=eks -t fans-api:eks .
```

### 3.2 docker-compose.yml에서 ARG 전달

```yaml
version: '3.8'

services:
  main-api:
    build:
      context: ./backend/api
      dockerfile: Dockerfile
      args:
        DEPLOY_ENV: ${DEPLOY_ENV:-local}
    # ... 나머지 설정
```

**실행**:
```bash
DEPLOY_ENV=ecs docker-compose build
DEPLOY_ENV=ecs docker-compose up -d
```

---

## 🚀 방법 4: Kubernetes ConfigMap/Secret (EKS용)

### 4.1 ConfigMap으로 환경변수 관리

**`k8s/configmap-local.yaml`**:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fans-config-local
  namespace: fans
data:
  NODE_ENV: "development"
  DB_HOST: "postgres"
  DB_PORT: "5432"
  # ... 기타 설정
```

**`k8s/configmap-eks.yaml`**:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fans-config-eks
  namespace: fans
data:
  NODE_ENV: "production"
  DB_HOST: "fans-db.abc123.ap-northeast-2.rds.amazonaws.com"
  DB_PORT: "5432"
  # ... 기타 설정
```

### 4.2 Deployment에서 사용

**`k8s/deployment.yaml`**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fans-api
spec:
  template:
    spec:
      containers:
      - name: api
        image: fans-api:latest
        envFrom:
        - configMapRef:
            name: fans-config-${ENVIRONMENT}  # Kustomize로 치환
```

### 4.3 Kustomize로 환경별 적용

**`k8s/overlays/local/kustomization.yaml`**:
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- ../../base

configMapGenerator:
- name: fans-config
  envs:
  - .env.local
```

**`k8s/overlays/eks/kustomization.yaml`**:
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- ../../base

configMapGenerator:
- name: fans-config
  envs:
  - .env.eks
```

**배포**:
```bash
# 로컬 환경
kubectl apply -k k8s/overlays/local

# EKS 환경
kubectl apply -k k8s/overlays/eks
```

---

## 🚀 방법 5: Terraform으로 자동 주입 (ECS/EKS)

### 5.1 ECS Task Definition

**`infra/terraform/ecs-task-definition.tf`**:

```hcl
locals {
  # 환경별 변수 맵
  env_vars = {
    local = {
      NODE_ENV = "development"
      DB_HOST  = "postgres"
      AI_SERVICE_URL = "http://summarize-ai:8000"
    }
    ecs = {
      NODE_ENV = "production"
      DB_HOST  = aws_db_instance.main.endpoint
      AI_SERVICE_URL = "http://summarize-ai.fans.local:8000"
    }
    eks = {
      NODE_ENV = "production"
      DB_HOST  = aws_db_instance.main.endpoint
      AI_SERVICE_URL = "http://summarize-ai.fans-svc.cluster.local:8000"
    }
  }

  # 현재 환경 선택
  current_env = var.deploy_environment  # "local", "ecs", "eks"
  selected_env_vars = local.env_vars[local.current_env]
}

resource "aws_ecs_task_definition" "api" {
  family = "fans-api"

  container_definitions = jsonencode([
    {
      name  = "api"
      image = "${aws_ecr_repository.api.repository_url}:latest"

      environment = [
        for key, value in local.selected_env_vars : {
          name  = key
          value = value
        }
      ]

      # Secrets Manager에서 민감 정보 주입
      secrets = [
        {
          name      = "DB_PASSWORD"
          valueFrom = aws_secretsmanager_secret.db_password.arn
        },
        {
          name      = "JWT_SECRET"
          valueFrom = aws_secretsmanager_secret.jwt_secret.arn
        }
      ]
    }
  ])
}
```

**`infra/terraform/variables.tf`**:
```hcl
variable "deploy_environment" {
  description = "Deployment environment"
  type        = string
  default     = "ecs"

  validation {
    condition     = contains(["local", "ecs", "eks"], var.deploy_environment)
    error_message = "deploy_environment must be one of: local, ecs, eks"
  }
}
```

**배포**:
```bash
# ECS 환경으로 배포
terraform apply -var="deploy_environment=ecs"

# EKS 환경으로 배포
terraform apply -var="deploy_environment=eks"
```

---

## 📋 .env 파일 예시

### .env.local (로컬 개발)

```env
# ================================
# Local Development Environment
# ================================
NODE_ENV=development

# Database (Docker Compose)
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=fans_user
DB_PASSWORD=fans_password
DB_NAME=fans_db

# AI Services (Docker Compose)
AI_SERVICE_URL=http://summarize-ai:8000
SUMMARIZE_AI_URL=http://summarize-ai:8000
BIAS_AI_URL=http://bias-analysis-ai:8002

# Frontend
FRONTEND_URL=http://localhost:3001
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# React (로컬)
REACT_APP_API_BASE=http://localhost:3000
REACT_APP_API_URL=http://localhost:3000/api

# OAuth (로컬 콜백)
KAKAO_REDIRECT_URI=http://localhost:3000/api/auth/kakao/callback
NAVER_REDIRECT_URI=http://localhost:3000/api/auth/naver/callback

# Security (개발용 - 약한 시크릿)
JWT_SECRET=local-dev-secret-not-for-production
SESSION_SECRET=local-session-secret
```

### .env.ecs (ECS 배포)

```env
# ================================
# ECS Production Environment
# ================================
NODE_ENV=production

# Database (RDS)
DB_HOST=fans-db.c1a2b3.ap-northeast-2.rds.amazonaws.com
DB_PORT=5432
DB_USERNAME=fans_user
DB_PASSWORD=${DB_PASSWORD}  # Secrets Manager에서 주입
DB_NAME=fans_db

# AI Services (ECS Service Discovery)
AI_SERVICE_URL=http://summarize-ai.fans.local:8000
SUMMARIZE_AI_URL=http://summarize-ai.fans.local:8000
BIAS_AI_URL=http://bias-analysis-ai.fans.local:8002

# Frontend (프로덕션 도메인)
FRONTEND_URL=https://fans.ai.kr
CORS_ALLOWED_ORIGINS=https://fans.ai.kr,https://www.fans.ai.kr,https://api.fans.ai.kr

# React (프로덕션 API)
REACT_APP_API_BASE=https://api.fans.ai.kr
REACT_APP_API_URL=https://api.fans.ai.kr/api

# OAuth (프로덕션 콜백)
KAKAO_REDIRECT_URI=https://api.fans.ai.kr/api/auth/kakao/callback
NAVER_REDIRECT_URI=https://api.fans.ai.kr/api/auth/naver/callback

# Security (Secrets Manager에서 주입)
JWT_SECRET=${JWT_SECRET}
SESSION_SECRET=${SESSION_SECRET}

# AWS 특화
AWS_REGION=ap-northeast-2
LOG_LEVEL=info
```

### .env.eks (EKS 배포)

```env
# ================================
# EKS Production Environment
# ================================
NODE_ENV=production

# Database (RDS)
DB_HOST=fans-db.c1a2b3.ap-northeast-2.rds.amazonaws.com
DB_PORT=5432
DB_USERNAME=fans_user
DB_PASSWORD=${DB_PASSWORD}  # Kubernetes Secret에서 주입
DB_NAME=fans_db

# AI Services (Kubernetes Service DNS)
AI_SERVICE_URL=http://summarize-ai.fans-svc.cluster.local:8000
SUMMARIZE_AI_URL=http://summarize-ai.fans-svc.cluster.local:8000
BIAS_AI_URL=http://bias-analysis-ai.fans-svc.cluster.local:8002

# Frontend (프로덕션 도메인)
FRONTEND_URL=https://fans.ai.kr
CORS_ALLOWED_ORIGINS=https://fans.ai.kr,https://www.fans.ai.kr,https://api.fans.ai.kr

# React (프로덕션 API)
REACT_APP_API_BASE=https://api.fans.ai.kr
REACT_APP_API_URL=https://api.fans.ai.kr/api

# OAuth (프로덕션 콜백)
KAKAO_REDIRECT_URI=https://api.fans.ai.kr/api/auth/kakao/callback
NAVER_REDIRECT_URI=https://api.fans.ai.kr/api/auth/naver/callback

# Security (Kubernetes Secret에서 주입)
JWT_SECRET=${JWT_SECRET}
SESSION_SECRET=${SESSION_SECRET}

# Kubernetes 특화
KUBERNETES_NAMESPACE=fans
LOG_LEVEL=info
```

### .env.example (Git 커밋용 템플릿)

```env
# ================================
# Environment Template
# ================================
# 이 파일을 복사해서 .env.local, .env.ecs, .env.eks 생성

NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_NAME=your_database

# AI Services
AI_SERVICE_URL=http://localhost:8000

# Frontend
FRONTEND_URL=http://localhost:3001
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# OAuth
KAKAO_CLIENT_ID=your_kakao_client_id
KAKAO_CLIENT_SECRET=your_kakao_secret
KAKAO_REDIRECT_URI=http://localhost:3000/api/auth/kakao/callback

# Security
JWT_SECRET=change-me-in-production
SESSION_SECRET=change-me-in-production
```

---

## 🔒 .gitignore 설정

```gitignore
# 실제 환경변수 파일 (절대 커밋 금지)
.env
.env.local
.env.ecs
.env.eks
.env.*.local
.env.production

# 백업 파일
.env.backup.*

# 템플릿은 커밋 가능
!.env.example
```

---

## 🚀 권장 방식 조합

### 로컬 개발
```bash
# 방법 1: 수동 전환
./scripts/switch-env.sh local
docker-compose up -d

# 방법 2: npm 스크립트
npm run start:local
```

### ECS 배포
```bash
# CI/CD에서 자동 선택
export DEPLOY_ENV=ecs
docker build --build-arg DEPLOY_ENV=ecs -t fans-api:ecs .
docker push ...

# 또는 Terraform이 자동 주입
terraform apply -var="deploy_environment=ecs"
```

### EKS 배포
```bash
# Kustomize로 환경별 설정 적용
kubectl apply -k k8s/overlays/eks

# 또는 Helm Chart values
helm install fans ./charts/fans -f values-eks.yaml
```

---

## ✅ 최종 권장 전략

| 환경 | 방법 | 도구 |
|------|------|------|
| **Local** | 스크립트 자동 선택 | `scripts/load-env.sh` + Docker Compose |
| **ECS** | Terraform 자동 주입 | Terraform + Secrets Manager |
| **EKS** | Kustomize/Helm | ConfigMap + Kubernetes Secrets |

---

**작성일**: 2025-10-23
**다음 단계**: 실제 파일 생성 및 스크립트 작성
