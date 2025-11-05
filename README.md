# FANS - Financial & Analytics News Service

AI 기반 뉴스 큐레이션 및 편향성 분석 플랫폼

[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-blue)](https://python.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue)](https://docs.docker.com/compose/)
[![AWS](https://img.shields.io/badge/AWS-EKS-orange)](https://aws.amazon.com/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-1.28+-blue)](https://kubernetes.io/)

---

## 📋 프로젝트 개요

FANS는 뉴스 크롤링, AI 기반 요약, 편향성 분석을 제공하는 종합 뉴스 플랫폼입니다.

### 핵심 기능

- 🤖 **AI 자동 요약** - T5-small 모델 기반 한국어 뉴스 요약 (60M 파라미터)
- 📊 **편향성 분석** - KoBERT 기반 정치 성향 및 감성 분석
- 🔍 **뉴스 크롤링** - 30초마다 자동 수집 (Daum, Naver)
- 📦 **배치 처리** - 매일 새벽 2시 과거 기사 1,000개 AI 처리
- 🔄 **오토스케일링** - KEDA 기반 큐 길이 자동 스케일링 (1~20 Pod)
- 💾 **자동 백업** - 매일 새벽 2시 학원 서버 DB 백업
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

# 3. Docker Compose 시작
docker-compose up -d

# 4. 프론트엔드 로컬 실행 (권장)
cd frontend
PORT=3001 npm start
```

### 접속 주소

- **프론트엔드**: https://www.fans.ai.kr
- **API 서버**: https://api.fans.ai.kr
- **로컬 개발**: http://localhost:3001

---

## 🏗️ 아키텍처

### 시스템 구성 (현재 운영 중)

```
┌─────────────────────┐
│   CloudFront + S3   │ (프론트엔드)
│  www.fans.ai.kr     │
└──────────┬──────────┘
           │
┌──────────▼───────────────────────┐
│  ALB + Ingress (NGINX)           │
│  api.fans.ai.kr                  │
└──────────┬───────────────────────┘
           │
┌──────────▼──────────────────────────────────┐
│         EKS Cluster (Kubernetes)            │
│  ┌──────────────────────────────────────┐   │
│  │  Main API (2 Pods, HA)               │   │
│  │  Unified Crawler (1 Pod)             │   │
│  │  Scheduler (2 Pods, HA)              │   │
│  │  AI Worker (1~20 Pods, KEDA)         │   │
│  │  Summarize AI (1 Pod)                │   │
│  │  Bias Analysis AI (2 Pods, HA)       │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────┐  ┌────────────┐              │
│  │  Redis   │  │ PostgreSQL │ (External)    │
│  │ElastiCache│  │   RDS      │              │
│  └──────────┘  └────────────┘              │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  Karpenter (오토스케일링)            │   │
│  │  - Spot Instance 우선 (70% 절감)     │   │
│  │  - On-Demand 대체 가능               │   │
│  └──────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

### 마이크로서비스 구성

| 서비스 | 레플리카 | 기술 스택 | 특징 |
|--------|---------|---------|------|
| Frontend | - | React 18 + S3 + CloudFront | CDN 캐싱 |
| Main API | 2 (HA) | Node.js + Express + TypeORM | 다중 AZ 분산 |
| Unified Crawler | 1 | Node.js + Cheerio | 30초 간격 크롤링 |
| Scheduler | 2 (HA) | Node.js + node-cron | 10분 간격 AI 작업 발행 |
| AI Worker | 1~20 (KEDA) | Node.js + BullMQ | 큐 기반 오토스케일링 |
| Summarize AI | 1 | Python + FastAPI + T5-small | 60M 파라미터 |
| Bias Analysis AI | 2 (HA) | Python + FastAPI + KoBERT | 감성 분석 |
| PostgreSQL RDS | - | PostgreSQL 15 | Multi-AZ |
| Redis ElastiCache | - | Redis 7 | BullMQ 큐 |

---

## ⚡ 자동화 시스템

### 1️⃣ 실시간 크롤링 (30초)
- Unified Crawler가 30초마다 Daum/Naver 뉴스 수집
- 중복 제거 후 `news_articles` 테이블 저장

### 2️⃣ AI 처리 (10분)
- Scheduler가 10분마다 요약 없는 기사 조회 (당일분만)
- BullMQ 큐에 작업 추가 → AI Worker가 처리
- 큐 길이에 따라 KEDA가 Worker 자동 스케일 (1~20개)

### 3️⃣ 배치 백로그 (매일 새벽 2시)
- 과거 기사 중 요약 없는 1,000개 처리
- 전체 백로그: 약 6,700개 → 예상 완료 7일
- Kubernetes CronJob으로 자동 실행

### 4️⃣ DB 백업 (매일 새벽 2시)
- RDS → 학원 서버 PostgreSQL 자동 백업
- 백업 대상: 약 21,000개 뉴스 + 사용자 데이터
- Kubernetes CronJob으로 자동 실행

---

## 🔄 오토스케일링 (2단계)

### 1단계: Pod 레벨 - KEDA
- **기준**: Redis 큐 길이 모니터링
- **스케일 업**: 
  - Summary 큐 5개당 Pod 1개 추가
  - Keyword/Bias 큐 10개당 Pod 1개 추가
- **스케일 다운**: 5분 쿨다운 후 축소
- **범위**: 최소 1개 → 최대 20개

### 2단계: 노드 레벨 - Karpenter
- **역할**: EC2 인스턴스 자동 생성/삭제
- **방식**: Pod Pending 시 1~2분 내 노드 추가
- **비용 절감**: Spot Instance 우선 (70% 절감)
- **인스턴스**: t3a.xlarge (AI), t3a.xlarge (General)

---

## 🛠️ 기술 스택

### Frontend
- React 18.2.0, React Router 6.x, Axios, CSS3
- **배포**: AWS S3 + CloudFront CDN

### Backend
- Node.js 18.x, Express.js, TypeScript 5.x
- TypeORM 0.3.x, JWT, OAuth 2.0
- **큐**: BullMQ (Redis 기반)

### AI/ML
- Python 3.10, FastAPI
- T5-small (요약, 60M), KoBERT (편향 분석)
- Transformers (Hugging Face)

### Database
- PostgreSQL 15 (RDS Multi-AZ)
- Redis 7 (ElastiCache)

### DevOps
- **컨테이너**: Docker, Kubernetes (EKS 1.28)
- **IaC**: Terraform
- **CI/CD**: GitHub Actions (경로별 트리거)
- **오토스케일링**: KEDA 2.x, Karpenter
- **모니터링**: CloudWatch Logs

---

## 📦 프로젝트 구조

```
D:\dev1
├── backend/
│   ├── api/                    # Main API (Node.js)
│   ├── crawler/
│   │   └── crawler-v2/        # 통합 크롤러 (Daum+Naver)
│   ├── ai/
│   │   ├── summarize-ai/      # T5-small 요약 AI
│   │   └── bias-analysis-ai/  # KoBERT 편향 분석
│   ├── scheduler/             # node-cron 스케줄러
│   ├── ai-worker/             # BullMQ Worker (AI 처리)
│   └── queue/                 # BullMQ 공통 모듈
│
├── frontend/                  # React 앱
├── docs/                      # 📄 문서 모음
├── environments/
│   ├── eks/
│   │   ├── manifests/        # Kubernetes YAML
│   │   ├── karpenter/        # Karpenter 설정
│   │   └── terraform/        # EKS 인프라
│   └── local/                # 로컬 Docker Compose
│
├── .github/workflows/         # GitHub Actions CI/CD
├── docker-compose.yml         # 로컬 개발 환경
├── Makefile                   # 빠른 명령어
└── CLAUDE.md                  # 프로젝트 메모리
```

---

## 💻 개발 가이드

### 로컬 개발 환경

```bash
# 1. 백엔드 서비스 시작 (Docker)
docker-compose up -d

# 2. 프론트엔드 로컬 실행 (권장)
cd frontend
PORT=3001 npm start

# 3. 로그 확인
docker-compose logs -f api
docker-compose logs -f crawler
```

### 유용한 명령어

```bash
# EKS 배포 확인
kubectl get pods -n fans
kubectl get hpa -n fans                    # KEDA 오토스케일러
kubectl get scaledobject -n fans           # KEDA ScaledObject

# 배치 작업 수동 실행
kubectl create job --from=cronjob/batch-summary-backlog test-batch -n fans
kubectl create job --from=cronjob/db-backup-to-school test-backup -n fans

# 로그 확인
kubectl logs -n fans -l app=ai-worker --tail=50
kubectl logs -n fans -l app=scheduler --tail=50
```

---

## 📊 성능 지표

- **일일 뉴스 수집**: 약 19,200개 (중복 제거 후 ~5,000개)
- **크롤링 주기**: 30초마다 자동 실행
- **AI 처리 시간**: 평균 3~8초/기사 (T5-small)
- **API 응답 시간**: 평균 < 200ms
- **현재 백로그**: 약 6,700개 (7일 내 완료 예상)

---

## 💰 비용 (월간)

### 현재 EKS 운영 비용: 약 $334/월

| 항목 | 비용 |
|------|------|
| EKS 클러스터 | $73 |
| EC2 노드 (2 On-Demand + Spot) | $120 |
| RDS PostgreSQL (Multi-AZ) | $80 |
| ElastiCache Redis | $30 |
| ALB + 데이터 전송 | $20 |
| CloudFront + S3 | $11 |

**비용 최적화**:
- Karpenter Spot Instance 사용 (70% 절감)
- KEDA로 야간 시간대 Pod 축소 (1개까지)

---

## 🔐 보안

- JWT 토큰 기반 인증
- bcrypt 비밀번호 해싱 (rounds=12)
- OAuth 2.0 소셜 로그인 (Kakao, Naver)
- CORS 정책 적용
- Kubernetes Secrets (민감 정보)
- ElastiCache/RDS 암호화

---

## 📚 문서

### 필수 문서
- **📖 문서 가이드**: [docs/README.md](docs/README.md) - 문서 네비게이션 및 역할별 읽기 순서
- **🚀 프로젝트 시작 가이드**: [docs/01_프로젝트_시작가이드.md](docs/01_프로젝트_시작가이드.md)
- **🏗️ 시스템 아키텍처**: [docs/02_시스템_아키텍처.md](docs/02_시스템_아키텍처.md)
- **⚙️ 운영 및 배포 가이드**: [docs/03_운영_및_배포_가이드.md](docs/03_운영_및_배포_가이드.md)

### 고급 문서
- **🚢 배포 전략 가이드**: [docs/04_배포_전략_가이드.md](docs/04_배포_전략_가이드.md) - Rolling/Canary/Blue-Green
- **⚡ 성능 최적화 가이드**: [docs/05_성능_최적화_가이드.md](docs/05_성능_최적화_가이드.md)
- **🔒 보안 가이드**: [docs/06_보안_가이드.md](docs/06_보안_가이드.md)
- **💰 비용 최적화 및 스케일링 가이드**: [docs/07_비용_최적화_및_스케일링_가이드.md](docs/07_비용_최적화_및_스케일링_가이드.md)
- **🆘 장애 대응 가이드**: [docs/08_장애_대응_가이드.md](docs/08_장애_대응_가이드.md)

### 참고 문서
- **💾 백업 가이드**: [docs/BACKUP_GUIDE.md](docs/BACKUP_GUIDE.md)
- **🗄️ DB 스키마**: [docs/final_database_structure.sql](docs/final_database_structure.sql)

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

프로젝트 관련 문의사항은 GitHub 이슈를 생성해주세요.

---

**Last Updated**: 2025-11-05
**Version**: 3.1 (문서 체계 개선 + KEDA 오토스케일링 + 배치 처리)
**Production**: https://www.fans.ai.kr

---

## 📖 문서 개선 사항 (v3.1)

2025-11-05 업데이트:
- ✅ docs 폴더 재구성 (8개 전문 가이드로 세분화)
- ✅ 04_고급_주제_및_참고자료.md → 5개 전문 문서로 분리
  - 배포 전략 가이드 (Rolling/Canary/Blue-Green)
  - 성능 최적화 가이드 (DB/API/AI 최적화)
  - 보안 가이드 (AWS/컨테이너/API 보안)
  - 비용 최적화 및 스케일링 가이드 (HPA/KEDA/Karpenter)
  - 장애 대응 가이드 (복구 절차 및 매뉴얼)
- ✅ 역할별 읽기 순서 가이드 추가
- ✅ 문서 제목 및 구조 개선
