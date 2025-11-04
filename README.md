# FANS - Financial & Analytics News Service

AI 기반 뉴스 큐레이션 및 편향성 분석 플랫폼

[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-blue)](https://python.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue)](https://docs.docker.com/compose/)
[![AWS](https://img.shields.io/badge/AWS-ECS%20%7C%20EKS-orange)](https://aws.amazon.com/)

---

## 📋 프로젝트 개요

FANS는 뉴스 크롤링, AI 기반 요약, 편향성 분석을 제공하는 종합 뉴스 플랫폼입니다.

### 핵심 기능

- 🤖 **AI 자동 요약** - T5 모델 기반 한국어 뉴스 요약
- 📊 **편향성 분석** - BERT 기반 정치 성향 및 감성 분석
- 🔍 **뉴스 크롤링** - 3분마다 자동 수집 (Daum, Naver)
- 👤 **개인화 추천** - 사용자 행동 기반 추천 알고리즘
- 🔐 **소셜 로그인** - 카카오, 네이버 OAuth 2.0

---

## 🚀 빠른 시작

### 전제 조건

- Docker & Docker Compose
- Node.js 18+ (로컬 개발 시)
- Git

### 1분 만에 시작하기

```bash
# 1. 저장소 클론
git clone <repository-url>
cd dev1

# 2. 환경 설정
cp .env.example .env.local

# 3. 로컬 환경으로 시작
make start-local

# 또는 스크립트 직접 실행
./scripts/switch-env.sh local
./scripts/docker-start.sh
```

### 접속 주소

- **프론트엔드**: http://localhost:3001
- **API 서버**: http://localhost:3000
- **API 문서**: http://localhost:3000/api-docs

---

## 🌍 멀티 환경 지원

FANS는 3가지 환경을 자동으로 지원합니다:

| 환경 | 설명 | 명령어 |
|------|------|--------|
| **Local** | 로컬 Docker Compose | `make start-local` |
| **ECS** | AWS ECS 배포 | `make start-ecs` |
| **EKS** | AWS EKS 배포 | `make start-eks` |

### 환경 전환

```bash
# 로컬 개발 환경
make env-local
make start

# ECS 프로덕션 환경
make env-ecs
make start

# EKS 프로덕션 환경
make env-eks
make start
```

📖 **상세 가이드**: [docs/QUICK_START_GUIDE.md](docs/QUICK_START_GUIDE.md)

---

## 🏗️ 아키텍처

### 시스템 구성

```
┌─────────────┐
│  Frontend   │ (React 18)
└──────┬──────┘
       │
┌──────▼─────────────────┐
│   Main API (Node.js)   │
└──────┬─────────────────┘
       │
   ┌───┴────┬─────────┬──────────┐
   │        │         │          │
┌──▼───┐ ┌─▼──┐ ┌────▼────┐ ┌───▼────┐
│ DB   │ │Redis│ │  AI 요약 │ │편향분석│
│(PG)  │ │     │ │  :8000   │ │ :8002  │
└──────┘ └─────┘ └─────────┘ └────────┘
```

### 마이크로서비스 구성

| 서비스 | 포트 | 기술 스택 |
|--------|------|---------|
| Frontend | 3001 | React 18 |
| Main API | 3000 | Node.js 18 + Express + TypeORM |
| API Crawler | 4005 | Node.js + Cheerio |
| Summarize AI | 8000 | Python + FastAPI + Transformers |
| Bias Analysis AI | 8002 | Python + FastAPI + KoBERT |
| Classification API | 5000 | Python + Flask + scikit-learn |
| Scheduler | - | Node.js + node-cron |
| PostgreSQL | 5432 | PostgreSQL 15 |
| Redis | 6379 | Redis 7 |

📖 **상세 아키텍처**: [docs/02_프로젝트_아키텍처_설명서.md](docs/02_프로젝트_아키텍처_설명서.md)

---

## 📚 문서

### 시작하기

- **빠른 시작 가이드**: [docs/QUICK_START_GUIDE.md](docs/QUICK_START_GUIDE.md)
- **설치 및 환경 구성**: [docs/03_설치_및_환경_구성_가이드.md](docs/03_설치_및_환경_구성_가이드.md)
- **멀티 환경 전략**: [docs/MULTI_ENV_STRATEGY.md](docs/MULTI_ENV_STRATEGY.md)

### 아키텍처 및 설계

- **프로젝트 아키텍처 설명서**: [docs/02_프로젝트_아키텍처_설명서.md](docs/02_프로젝트_아키텍처_설명서.md)
- **시스템 아키텍처 가이드**: [docs/SYSTEM_ARCHITECTURE_GUIDE.md](docs/SYSTEM_ARCHITECTURE_GUIDE.md)
- **AI 학습 및 뉴스 분석 시스템**: [docs/AI_학습_및_뉴스_분석_시스템_정리.md](docs/AI_학습_및_뉴스_분석_시스템_정리.md)
- **편향성 분석 설계**: [docs/bias-analysis-design.md](docs/bias-analysis-design.md)

### 배포 및 인프라

- **ECS 마이그레이션 가이드**: [docs/ECS_MIGRATION_ENV_GUIDE.md](docs/ECS_MIGRATION_ENV_GUIDE.md)
- **EKS 운영 가이드**: [docs/01_EKS_운영_가이드.md](docs/01_EKS_운영_가이드.md)
- **AWS 마이그레이션 아키텍처**: [docs/aws-migration-architecture.md](docs/aws-migration-architecture.md)

### 데이터베이스

- **최종 DB 스키마**: [docs/final_database_structure.sql](docs/final_database_structure.sql)
- **DB 검증 보고서**: [docs/FANS_데이터베이스_검증_보고서.md](docs/FANS_데이터베이스_검증_보고서.md)
- **DB 구조 비교 분석**: [docs/DB_구조_비교분석_상세.md](docs/DB_구조_비교분석_상세.md)

### 기타

- **크롤러 서비스 분리 계획**: [docs/CRAWLER_SERVICE_SEPARATION_PLAN.md](docs/CRAWLER_SERVICE_SEPARATION_PLAN.md)
- **언론사 크롤링 분석**: [docs/언론사_크롤링_분석_보고서.md](docs/언론사_크롤링_분석_보고서.md)
- **정리 작업 보고서**: [docs/CLEANUP_REPORT.md](docs/CLEANUP_REPORT.md)

📖 **전체 문서 색인**: [docs/README.md](docs/README.md)

---

## 🛠️ 기술 스택

### Frontend
- React 18.2.0
- React Router 6.x
- Axios
- CSS3

### Backend
- Node.js 18.x
- Express.js 4.x
- TypeScript 5.x
- TypeORM 0.3.x
- JWT Authentication
- OAuth 2.0 (Kakao, Naver)

### AI/ML
- Python 3.10
- FastAPI / Flask
- Transformers (Hugging Face)
- KoBERT (감성 분석)
- T5 (요약)
- scikit-learn (분류)

### Database
- PostgreSQL 15
- Redis 7

### DevOps
- Docker & Docker Compose
- Terraform (IaC)
- AWS ECS / EKS
- GitHub Actions (CI/CD)

---

## 📦 프로젝트 구조

```
D:\dev1
├── backend/
│   ├── api/                    # Main API (Node.js)
│   ├── crawler/
│   │   └── crawler-v2/        # 통합 크롤러
│   ├── ai/
│   │   ├── summarize-ai/      # 요약 AI
│   │   └── bias-analysis-ai/  # 편향 분석 AI
│   ├── scheduler/             # 작업 스케줄러
│   ├── ai-worker/             # BullMQ Worker (AI 처리)
│   ├── queue/                 # BullMQ 공통 모듈
│   ├── recommendation/        # 분류 API (Classification)
│   └── database/              # DB 스키마
│
├── frontend/                  # React 앱
├── docs/                      # 📄 문서 모음
├── infra/
│   ├── terraform/            # Terraform IaC
│   └── kubernetes/           # K8s 매니페스트
│
├── scripts/
│   ├── load-env.sh           # 환경 자동 감지
│   ├── switch-env.sh         # 환경 수동 전환
│   └── docker-start.sh       # Docker Compose 실행
│
├── .env.local                # 로컬 환경변수
├── .env.ecs                  # ECS 환경변수
├── .env.eks                  # EKS 환경변수
├── docker-compose.yml        # Docker Compose 설정
├── Makefile                  # 빠른 명령어
└── CLAUDE.md                 # 프로젝트 메모리
```

---

## 💻 개발 가이드

### 로컬 개발 환경 설정

```bash
# 1. 환경 파일 생성
cp .env.example .env.local

# 2. DB 비밀번호 등 설정
nano .env.local

# 3. Docker Compose 시작
make start-local

# 4. 프론트엔드 로컬 실행 (권장)
cd frontend
PORT=3001 npm start
```

### 유용한 명령어

```bash
# 로그 확인
make logs              # 전체 로그
make logs-api          # API 로그만
make logs-crawler      # 크롤러 로그만

# 환경 확인
make current-env       # 현재 환경 확인

# 재시작
make restart           # 전체 재시작

# 정리
make stop              # 중지
make clean             # 중지 + 볼륨 삭제
```

---

## 🧪 테스트

```bash
# API 서버 테스트
cd backend/api
npm test

# 커버리지 확인
npm run test:coverage

# E2E 테스트
npm run test:e2e
```

---

## 📊 성능 지표

- **일일 뉴스 수집**: 약 19,200개 (중복 제거 후 ~5,000개)
- **크롤링 주기**: 3분마다 자동 실행
- **AI 처리 시간**: 평균 8초/기사
- **API 응답 시간**: 평균 < 200ms (캐시 히트)

---

## 🔐 보안

- JWT 토큰 기반 인증
- bcrypt 비밀번호 해싱 (rounds=12)
- OAuth 2.0 소셜 로그인
- CORS 정책 적용
- AWS Secrets Manager (프로덕션)
- Kubernetes Secrets (EKS)

---

## 🌐 배포

### ECS 배포

```bash
# 1. 환경 전환
make env-ecs

# 2. Terraform 인프라 생성
cd infra/terraform
terraform apply -var="deploy_environment=ecs"

# 3. Docker 이미지 빌드 및 푸시
docker build --build-arg DEPLOY_ENV=ecs -t fans-api:ecs .
docker push <ecr-repository-url>
```

### EKS 배포

```bash
# 1. 환경 전환
make env-eks

# 2. Terraform EKS 클러스터 생성
cd infra/terraform
terraform apply -var="deploy_environment=eks"

# 3. Kubernetes 매니페스트 배포
kubectl apply -k k8s/overlays/eks
```

📖 **배포 가이드**: [docs/01_EKS_운영_가이드.md](docs/01_EKS_운영_가이드.md)

---

## 🤝 기여

이 프로젝트는 협업 프로젝트입니다. 기여 전에 다음을 확인하세요:

1. **CLAUDE.md** - 프로젝트 규칙 및 주의사항
2. **데이터베이스 및 Entity 절대 수정 금지** (팀원 협업)
3. 주석 처리된 코드 (Spark, Kafka, Airflow) 삭제 금지

---

## 📄 라이선스

이 프로젝트는 [MIT License](LICENSE)를 따릅니다.

---

## 📞 문의

프로젝트 관련 문의사항은 이슈를 생성해주세요.

---

**Last Updated**: 2025-10-23
**Version**: 2.0 (멀티 환경 지원)
