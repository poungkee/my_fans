# FANS 프로젝트 빠른 시작 가이드

**날짜**: 2025-10-23
**버전**: 2.0 (멀티 환경 지원)

---

## 🎯 환경별 .env 파일 자동 선택

이제 FANS 프로젝트는 3가지 환경을 자동으로 지원합니다:
- **Local**: 로컬 Docker Compose 개발
- **ECS**: AWS ECS 배포
- **EKS**: AWS EKS (Kubernetes) 배포

---

## 📁 파일 구조

```
D:\dev1
├── .env              # 현재 활성 환경 (심볼릭 링크 또는 복사본)
├── .env.local        # 로컬 개발용
├── .env.ecs          # ECS 배포용
├── .env.eks          # EKS 배포용
├── .env.example      # 템플릿 (Git 커밋용)
│
├── scripts/
│   ├── load-env.sh      # 자동 환경 감지
│   ├── switch-env.sh    # 수동 환경 전환
│   └── docker-start.sh  # Docker Compose 실행
│
├── Makefile          # 빠른 명령어
└── docker-compose.yml
```

---

## 🚀 방법 1: Makefile 사용 (가장 간편)

### 로컬 개발

```bash
# 로컬 환경으로 시작
make start-local

# 또는 환경 전환 후 시작
make env-local
make start
```

### ECS 시뮬레이션

```bash
# ECS 환경으로 시작
make start-ecs
```

### EKS 시뮬레이션

```bash
# EKS 환경으로 시작
make start-eks
```

### 기타 명령어

```bash
# 현재 환경 확인
make current-env

# 로그 확인
make logs
make logs-api
make logs-crawler

# 중지
make stop

# 완전 정리 (볼륨 포함)
make clean

# 도움말
make help
```

---

## 🚀 방법 2: 스크립트 직접 실행

### 1. 환경 수동 전환

```bash
# 로컬 환경으로 전환
./scripts/switch-env.sh local

# ECS 환경으로 전환
./scripts/switch-env.sh ecs

# EKS 환경으로 전환
./scripts/switch-env.sh eks
```

### 2. Docker Compose 시작

```bash
# 자동 환경 감지 후 시작
./scripts/docker-start.sh

# 또는 직접 Docker Compose
docker-compose up -d
```

---

## 🚀 방법 3: 환경변수로 지정

### Docker Compose 실행 시 지정

```bash
# 로컬 환경
DEPLOY_ENV=local docker-compose up -d

# ECS 환경
DEPLOY_ENV=ecs docker-compose up -d

# EKS 환경
DEPLOY_ENV=eks docker-compose up -d
```

### 환경변수 설정 후 실행

```bash
# 환경변수 설정
export DEPLOY_ENV=ecs

# 자동 감지 스크립트 실행
./scripts/load-env.sh

# Docker Compose 실행
docker-compose up -d
```

---

## 🚀 방법 4: 자동 감지 (클라우드 환경)

클라우드에서 실행 시 자동으로 환경이 감지됩니다:

### ECS에서 자동 감지

```bash
# ECS 컨테이너에서 실행 시 자동으로 .env.ecs 사용
./scripts/load-env.sh
# 출력: 감지된 환경: ecs
```

**감지 기준**: `ECS_CONTAINER_METADATA_URI` 환경변수 존재

### EKS에서 자동 감지

```bash
# Kubernetes Pod에서 실행 시 자동으로 .env.eks 사용
./scripts/load-env.sh
# 출력: 감지된 환경: eks
```

**감지 기준**: `KUBERNETES_SERVICE_HOST` 환경변수 존재

---

## 📋 각 환경별 주요 차이점

### .env.local (로컬 개발)

```env
NODE_ENV=development

# Docker Compose 서비스 이름 사용
DB_HOST=postgres
AI_SERVICE_URL=http://summarize-ai:8000

# 로컬호스트
FRONTEND_URL=http://localhost:3001
KAKAO_REDIRECT_URI=http://localhost:3000/api/auth/kakao/callback

# 약한 시크릿 (개발용)
JWT_SECRET=local-dev-secret
```

### .env.ecs (ECS 배포)

```env
NODE_ENV=production

# RDS 엔드포인트
DB_HOST=fans-db.abc123.ap-northeast-2.rds.amazonaws.com

# ECS Service Discovery
AI_SERVICE_URL=http://summarize-ai.fans.local:8000

# 프로덕션 도메인
FRONTEND_URL=https://fans.ai.kr
KAKAO_REDIRECT_URI=https://api.fans.ai.kr/api/auth/kakao/callback

# Secrets Manager에서 주입
JWT_SECRET=${JWT_SECRET}
```

### .env.eks (EKS 배포)

```env
NODE_ENV=production

# RDS 엔드포인트
DB_HOST=fans-db.abc123.ap-northeast-2.rds.amazonaws.com

# Kubernetes Service DNS
AI_SERVICE_URL=http://summarize-ai.fans-svc.svc.cluster.local:8000

# 프로덕션 도메인
FRONTEND_URL=https://fans.ai.kr
KAKAO_REDIRECT_URI=https://api.fans.ai.kr/api/auth/kakao/callback

# Kubernetes Secret에서 주입
JWT_SECRET=${JWT_SECRET}
```

---

## 🔍 환경 확인 방법

### 현재 .env 파일이 어느 환경인지 확인

```bash
# Makefile 사용
make current-env

# 또는 직접 비교
diff .env .env.local && echo "LOCAL 환경"
diff .env .env.ecs && echo "ECS 환경"
diff .env .env.eks && echo "EKS 환경"

# 또는 주요 설정 확인
cat .env | grep "DB_HOST"
cat .env | grep "NODE_ENV"
```

---

## 🔧 트러블슈팅

### 문제: .env 파일이 전환되지 않음

```bash
# 스크립트 실행 권한 확인
ls -la scripts/*.sh

# 권한이 없으면
chmod +x scripts/*.sh
```

### 문제: 환경 파일이 없다는 오류

```bash
# .env.local이 없으면 현재 .env를 복사
cp .env .env.local

# 또는 템플릿에서 생성
cp .env.example .env.local
cp .env.example .env.ecs
cp .env.example .env.eks
```

### 문제: Docker Compose가 잘못된 환경변수 사용

```bash
# 캐시 삭제 후 재시작
docker-compose down
docker-compose up -d --force-recreate
```

### 문제: React 빌드 시 환경변수가 적용 안됨

```bash
# React는 빌드 시점에 환경변수가 고정됨
# 환경 전환 후 반드시 재빌드 필요

# 로컬 환경으로 전환
make env-local

# 프론트엔드 재빌드
docker-compose build frontend

# 재시작
docker-compose up -d frontend
```

---

## 🎯 실전 예시

### 시나리오 1: 로컬 개발 → ECS 배포 테스트

```bash
# 1. 로컬 개발 시작
make start-local

# 2. 개발 및 테스트
# ...

# 3. ECS 환경으로 전환 (로컬에서 시뮬레이션)
make stop
make env-ecs

# 4. ECS 설정 확인
cat .env | grep "DB_HOST"
# 출력: DB_HOST=fans-db.abc123...

# 5. Docker 이미지 재빌드 (환경변수 포함)
DEPLOY_ENV=ecs docker-compose build

# 6. 시작
make start

# 7. 테스트 후 다시 로컬로
make stop
make env-local
make start
```

### 시나리오 2: CI/CD 파이프라인에서 자동 선택

**GitHub Actions 예시**:
```yaml
# .github/workflows/deploy-ecs.yml
name: Deploy to ECS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: 환경 설정
        run: |
          # ECS 환경으로 자동 전환
          ./scripts/switch-env.sh ecs

      - name: Docker 이미지 빌드
        run: |
          DEPLOY_ENV=ecs docker build \
            --build-arg DEPLOY_ENV=ecs \
            -t fans-api:ecs \
            ./backend/api

      - name: ECR 푸시
        run: |
          # ... ECR 푸시 로직
```

### 시나리오 3: 개발자마다 다른 환경 사용

```bash
# 개발자 A (로컬 Docker Compose)
make start-local

# 개발자 B (로컬 Kubernetes - Minikube)
make start-eks

# 개발자 C (AWS ECS 개인 계정)
make start-ecs
```

---

## 📚 추가 문서

- **상세 전략**: `docs/MULTI_ENV_STRATEGY.md`
- **ECS 마이그레이션**: `docs/ECS_MIGRATION_ENV_GUIDE.md`
- **아키텍처 설명**: `docs/02_프로젝트_아키텍처_설명서.md`

---

## ✅ 체크리스트

### 최초 설정 시

- [ ] `.env.local`, `.env.ecs`, `.env.eks` 파일 생성
- [ ] 스크립트 실행 권한 부여 (`chmod +x scripts/*.sh`)
- [ ] `.gitignore`에 `.env*` 추가 (템플릿 제외)
- [ ] OAuth Redirect URI 환경별로 등록

### 로컬 개발 시

- [ ] `make env-local` 또는 `./scripts/switch-env.sh local`
- [ ] `make start-local`
- [ ] 포트 확인: 3000 (API), 3001 (Frontend)

### ECS 배포 시

- [ ] Terraform으로 RDS 엔드포인트 확인
- [ ] `.env.ecs`의 `DB_HOST` 업데이트
- [ ] Secrets Manager에 민감 정보 저장
- [ ] OAuth Redirect URI 프로덕션 URL로 등록
- [ ] Docker 이미지 빌드 시 `DEPLOY_ENV=ecs` 지정

### EKS 배포 시

- [ ] Terraform으로 RDS 엔드포인트 확인
- [ ] `.env.eks`의 `DB_HOST` 업데이트
- [ ] Kubernetes Secret 생성
- [ ] Service DNS 네임스페이스 확인
- [ ] OAuth Redirect URI 프로덕션 URL로 등록

---

**작성일**: 2025-10-23
**업데이트**: 멀티 환경 자동 선택 기능 추가
