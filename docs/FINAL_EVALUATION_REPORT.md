# FANS 프로젝트 평가 보고서

**FANS - Financial & Analytics News Service**
**AI 기반 뉴스 큐레이션 및 편향성 분석 플랫폼**

작성일: 2025년 11월 9일 | 버전: 3.0 | 대상: 외부 평가자 및 협력사

---

## 📑 Executive Summary

FANS(Financial & Analytics News Service)는 뉴스 데이터를 자동으로 수집하고, AI가 이를 요약하고 편향성을 분석해 사용자가 신뢰성 있는 뉴스를 빠르게 파악할 수 있도록 돕는 AI 뉴스 큐레이션 플랫폼입니다.

플랫폼은 **AWS EKS**를 중심으로 운영되며, **KEDA + HPA + Karpenter**로 구성된 3단계 오토스케일링 시스템을 통해 트래픽 증가나 대기 작업이 발생하더라도 즉시 리소스를 확장할 수 있습니다. EKS 클러스터는 Multi-AZ 환경에서 운영되어 고가용성을 확보하고 있으며, PostgreSQL RDS, ElastiCache Redis, CloudFront, Route 53 등 AWS 주요 서비스와 통합되어 안정성과 확장성을 모두 달성했습니다.

### 주요 성과

- ✅ **완전 자동화**: 크롤링 → AI 처리 → 저장까지 사람 개입 0%
- ✅ **비용 효율성**: v1.0 대비 75% 메모리 절감, KEDA로 79% Pod 비용 절감
- ✅ **고가용성**: Multi-AZ 배포로 99.9% 가동률 보장
- ✅ **확장성**: 3단계 오토스케일링 (HPA + KEDA + Karpenter)
- ✅ **AI 처리**: T5 기반 요약, KoBERT 기반 편향 분석

---

## 1️⃣ 프로젝트 구성 및 역할

본 프로젝트는 5인 협업 체제로 진행되었으며, 각 팀원은 다음과 같은 역할을 담당했습니다.

| 팀원 | 담당 영역 | 주요 역할 |
|------|----------|-----------|
| **김현애** | 인프라 및 아키텍처 설계 | AWS EKS 클러스터 설계, Terraform IaC 구축, KEDA/Karpenter 오토스케일링, 보안 구성 |
| **이성재** | 백엔드 개발 | Main API 서버 구축, TypeORM 데이터베이스 설계, JWT/OAuth 인증·인가 로직 구현 |
| **박정민** | AI 파이프라인 | T5/KoBERT 모델 배포, AI Worker BullMQ 파이프라인 운영, 추천 알고리즘 개발 |
| **이채린** | 프론트엔드 개발 | React 18 기반 UI/UX 개발, CloudFront + S3 정적 배포, 반응형 디자인 |
| **김도연** | DevOps 및 모니터링 | GitHub Actions CI/CD, Prometheus/Grafana 모니터링, Slack 알림 시스템 구축 |

---

## 2️⃣ 서비스 개요

### 2.1 사용자 경험

사용자는 브라우저를 통해 **www.fans.ai.kr**에 접속하면, CloudFront를 통해 React 18 기반의 정적 웹 자산을 로드하게 됩니다. 웹 애플리케이션이 구동되면 API 요청은 ALB를 통해 EKS 내부의 Main API로 전달되며, API 서버는 PostgreSQL RDS와 ElastiCache Redis를 병행 사용하여 빠르고 안정적인 응답을 제공합니다.

### 2.2 주요 기능

사용자는 다음과 같은 기능을 이용할 수 있습니다:

- **뉴스 피드**: 카테고리별 맞춤 뉴스 (정치, 경제, 사회, IT/과학 등 8개)
- **AI 요약**: T5-small 모델 기반 3문장 자동 요약
- **편향성 분석**: KoBERT 기반 정치 성향 및 감성 분석
- **전문 검색**: PostgreSQL tsvector를 활용한 전문 검색
- **북마크**: 관심 기사 저장 및 관리
- **댓글**: 사용자 의견 공유
- **추천 알고리즘**: 사용자 행동 기반 개인화 추천
- **소셜 로그인**: 카카오, 네이버 OAuth 2.0 지원

### 2.3 운영 URL

- **프론트엔드**: https://www.fans.ai.kr
- **API 서버**: https://api.fans.ai.kr
- **로컬 개발**: http://localhost:3001

---

## 3️⃣ 시스템 아키텍처

### 3.1 전체 시스템 구성도

```
┌─────────────────────────────────────────────────────┐
│                    사용자                            │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
                       ↓
┌──────────────────────────────────────────────────────┐
│              Route 53 (DNS)                          │
│          fans.ai.kr → CloudFront                     │
└──────────────────────┬──────────────────────────────┘
                       │
                       ↓
┌──────────────────────────────────────────────────────┐
│          CloudFront CDN + WAF                        │
│      /frontend/* → S3 (React App)                    │
│      /profiles/* → S3 (프로필 이미지)                 │
│      /api/* → ALB                                    │
└──────────────────────┬──────────────────────────────┘
                       │
                       ↓
┌──────────────────────────────────────────────────────┐
│        ALB (Application Load Balancer)               │
│          HTTPS → HTTP (내부 통신)                     │
│          ACM 인증서 (자동 갱신)                       │
└──────────────────────┬──────────────────────────────┘
                       │
                       ↓
┌──────────────────────────────────────────────────────┐
│              EKS Cluster (Kubernetes 1.31)           │
│              Private Subnet (Multi-AZ)               │
│                                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │  General Workers (t3.large × 2)             │    │
│  │    ├ main-api (2 pods, HPA 2~10)            │    │
│  │    ├ scheduler (2 pods, HA)                 │    │
│  │    └ unified-crawler (1 pod)                │    │
│  └─────────────────────────────────────────────┘    │
│                                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │  AI Workers (t3a.xlarge × 2)                │    │
│  │    ├ summarize-ai (2 pods, HA)              │    │
│  │    ├ bias-analysis-ai (2 pods, HA)          │    │
│  │    └ recommendation-ai (1 pod)              │    │
│  └─────────────────────────────────────────────┘    │
│                                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │  Karpenter Nodes (c5.xlarge Spot, 동적)     │    │
│  │    └ ai-worker (1~20 pods, KEDA)            │    │
│  └─────────────────────────────────────────────┘    │
│                                                       │
└────────────┬──────────────────────┬──────────────────┘
             │                      │
             ↓                      ↓
┌────────────────────┐    ┌──────────────────┐
│ RDS PostgreSQL 15  │    │ ElastiCache Redis│
│   (Multi-AZ)       │    │   (Multi-AZ)     │
│   db.t3.medium     │    │ cache.t3.micro   │
│   100GB gp3        │    │   0.5GB          │
└────────────────────┘    └──────────────────┘
```

### 3.2 마이크로서비스 구성

| # | 서비스명 | 기술 스택 | 포트 | 레플리카 | 역할 |
|---|---------|---------|------|---------|------|
| 1 | **Main API** | Node.js 20 + Express + TypeORM | 3000 | 2~10 (HPA) | RESTful API 제공 |
| 2 | **Unified Crawler** | Node.js 20 + Cheerio | 4005 | 1 | 뉴스 수집 (30분마다) |
| 3 | **Scheduler** | Node.js 20 + node-cron | 8080 | 2 (HA) | 작업 스케줄링 (10분마다) |
| 4 | **AI Worker** | Node.js 20 + BullMQ | - | 1~20 (KEDA) | 큐 기반 AI 처리 |
| 5 | **Summarize AI** | Python 3.10 + FastAPI + T5 | 8000 | 2 | T5 모델 요약 |
| 6 | **Bias Analysis AI** | Python 3.10 + FastAPI + KoBERT | 8002 | 2 | KoBERT 편향 분석 |
| 7 | **Recommendation AI** | Python 3.10 + FastAPI | 8003 | 1 | 추천 알고리즘 |
| 8 | **PostgreSQL** | PostgreSQL 15 | 5432 | Multi-AZ | 메인 데이터베이스 |
| 9 | **Redis** | Redis 7 | 6379 | Multi-AZ | BullMQ 큐 + 캐시 |

**총 Pod 수**: 10~30개 (AI Worker 스케일링에 따라 변동)

---

## 4️⃣ 데이터 흐름 및 AI 파이프라인

### 4.1 크롤링 → AI → 저장 흐름

```
[1] Daum/Naver API
      ↓ (HTTP 요청, 30분마다)
[2] Unified Crawler
      ↓ (중복 제거 + 카테고리 포함)
[3] news_articles 테이블 (PostgreSQL)
      ↓ (BullMQ 큐 즉시 발행)
[4] Redis Queue (bull:ai-summary:wait)
      ↓ (KEDA가 큐 길이 모니터링)
[5] AI Worker (1~20 pods, 오토스케일링)
      ↓
      ├─ [6] Summarize AI (T5-small) → news_articles.ai_summary 업데이트
      ├─ [7] Bias Analysis AI (KoBERT) → bias_analysis 테이블 저장
      └─ [8] Keyword Extraction (KoNLPy) → keywords 테이블 저장
```

### 4.2 처리 성능

| 단계 | 소요 시간 | 비고 |
|------|---------|------|
| **크롤링** | ~2초/기사 | HTTP 요청 + HTML 파싱 |
| **DB 저장** | ~0.1초/기사 | INSERT + 인덱스 업데이트 |
| **큐 발행** | ~0.01초/작업 | Redis LPUSH |
| **요약 (T5)** | ~3초/기사 | CPU 추론 |
| **편향 분석 (KoBERT)** | ~2초/기사 | CPU 추론 |
| **키워드 추출** | ~0.5초/기사 | KoNLPy 형태소 분석 |
| **총 처리 시간** | **~5.5초/기사** | 병렬 처리로 단축 |

### 4.3 일일 처리 통계

| 항목 | 값 | 비고 |
|------|-----|------|
| **크롤링 횟수** | 48회/일 | 30분마다 |
| **회당 수집량** | 40개 | 카테고리당 5개 × 8 |
| **일일 크롤링 총량** | 1,920개 | 중복 포함 |
| **중복 제거 후** | ~800개 | URL 중복 제거 |
| **AI 처리 큐 발행** | 즉시 | 크롤링 직후 |
| **일일 AI 처리량** | ~800개 | Worker 병렬 처리 |

---

## 5️⃣ 3단계 오토스케일링

### 5.1 1단계: HPA (Horizontal Pod Autoscaler)

**대상**: Main API
**메트릭**: CPU 50%, Memory 70%
**범위**: 2~10 Pod

```yaml
CPU 50% 초과 → Pod 추가 (최대 100% 증가, 15초마다)
메모리 70% 초과 → Pod 추가
부하 감소 → 60초 대기 후 50%씩 축소 (30초마다)
```

**효과**: 트래픽 증가 시 API 서버 자동 확장

### 5.2 2단계: KEDA (Kubernetes Event Driven Autoscaler)

**대상**: AI Worker
**트리거**: Redis 큐 길이
**범위**: 1~20 Pod

```yaml
큐 길이 0~4: 1개 Pod (최소)
큐 길이 5~9: 2개 Pod (5개당 1개 규칙)
큐 길이 10~14: 3개 Pod
큐 길이 100+: 20개 Pod (최대)
```

**스케일링 시나리오**:
```
08:00 - 큐: 0개, Pod: 1개 (대기)
10:30 - 크롤러 실행, 큐: 240개 추가
10:31 - KEDA 감지, Pod: 20개로 스케일 업 (최대)
10:35 - 병렬 처리 중, 큐: 180개
10:45 - 큐: 60개, Pod: 12개로 축소
10:55 - 큐: 0개
11:00 - 5분 대기 후 Pod: 1개로 축소
```

**비용 절감 효과**:
- 기존 (20개 상시): 14,400 Pod-시간/월
- KEDA (동적): 3,000 Pod-시간/월
- **절감률: 79%**

### 5.3 3단계: Karpenter (노드 레벨 스케일링)

**역할**: EC2 인스턴스 자동 생성/삭제
**트리거**: Pod Pending (노드 부족)
**인스턴스**: Spot 우선 (70% 절감)

```
[1] KEDA가 AI Worker Pod 20개로 증가 요청
     ↓
[2] 현재 노드: 2개 (각 4 Pod 수용, 총 8 Pod)
     ↓
[3] Pending Pod: 12개 발생
     ↓
[4] Karpenter가 감지 (15초 대기)
     ↓
[5] c5.xlarge Spot 인스턴스 3개 생성 (1~2분)
     ↓
[6] 12개 Pod 자동 배치
     ↓
[7] 총 노드: 5개, 총 Pod: 20개
```

**NodePool 구성**:
- **General NodePool**: On-Demand (안정성 중요, t3.medium~large)
- **AI Worker NodePool**: Spot (비용 절감, c5/c6i.xlarge)

**Spot 중단 대응**:
1. AWS가 2분 전 경고 전송
2. Karpenter가 새 노드 생성
3. Pod Graceful Shutdown (120초)
4. 새 노드에 Pod 재배치
5. 기존 노드 종료

---

## 6️⃣ 데이터베이스 설계

### 6.1 PostgreSQL 15 (RDS Multi-AZ)

**스펙**:
- 인스턴스: db.t3.medium (2 vCPU, 4GB RAM)
- 스토리지: 100GB gp3 (3000 IOPS)
- Multi-AZ: 활성화 (자동 장애 조치 2~3분)
- 백업: 7일 보관, 매일 새벽 3시 (UTC)
- 암호화: 저장 데이터 암호화 활성화

**주요 테이블 (15개)**:

| 테이블 | 설명 | 레코드 수 |
|--------|------|----------|
| **news_articles** | 뉴스 기사 (ai_summary 포함) | ~21,000개 |
| **sources** | 언론사 마스터 | 13개 |
| **categories** | 카테고리 마스터 | 8개 |
| **bias_analysis** | 편향성 분석 결과 | ~21,000개 |
| **keywords** | 키워드 매핑 | ~50,000개 |
| **users** | 사용자 정보 | ~500개 |
| **user_actions** | 사용자 행동 로그 (VIEW, LIKE, BOOKMARK) | ~10,000개 |
| **bookmarks** | 북마크 | ~1,000개 |
| **comments** | 댓글 | ~500개 |
| **user_topics** | 사용자 관심사 | ~500개 |

**인덱스 전략**:
- `idx_news_pub_date`: 최신 기사 조회 (DESC)
- `idx_news_source_id`: 언론사별 필터링
- `idx_news_category_id`: 카테고리별 필터링
- `idx_news_search_vector`: 전문 검색 (GIN 인덱스)

### 6.2 Redis 7 (ElastiCache Multi-AZ)

**스펙**:
- 노드: cache.t3.micro (0.5GB)
- Multi-AZ: Primary + Replica (자동 장애 조치)
- 백업: 5일 보관, 스냅샷 자동 생성
- 암호화: at-rest 활성화

**사용 용도**:
1. **BullMQ 작업 큐**:
   - `bull:ai-summary:wait`: 요약 대기 작업
   - `bull:ai-keyword:wait`: 키워드 대기 작업
   - `bull:ai-bias:wait`: 편향 분석 대기 작업

2. **API 캐싱**:
   - `news:feed:{topics}:{limit}`: 뉴스 피드 (TTL 5분)
   - 캐시 히트율: 70%
   - 응답 시간: <100ms (캐시 히트 시)

3. **세션 저장소**:
   - `sess:{sessionId}`: 사용자 세션 (TTL 24시간)

---

## 7️⃣ 모니터링 및 알림 시스템

### 7.1 Prometheus + Grafana

**구성**:
```
Prometheus (메트릭 수집)
  ├ Node Exporter (노드 메트릭)
  ├ cAdvisor (컨테이너 메트릭)
  ├ Kube-state-metrics (Kubernetes 리소스)
  └ Custom Exporters (Redis, PostgreSQL)
       ↓
Grafana (시각화)
  ├ EKS 클러스터 대시보드
  ├ Pod 리소스 모니터링
  ├ KEDA 오토스케일링 현황
  └ API 응답 시간 그래프
       ↓
Alertmanager (알림)
  └ Slack #alarm 채널
```

**주요 대시보드**:
1. **EKS 클러스터 개요**: CPU, 메모리, Pod 상태
2. **AI Worker 모니터링**: 큐 길이, 처리 속도, KEDA 스케일링
3. **API 성능**: 응답 시간, 에러율, 캐시 히트율
4. **데이터베이스**: RDS 연결 수, 느린 쿼리, 디스크 사용률

### 7.2 CloudWatch Logs

**수집 대상**:
- EKS Control Plane 로그 (API, Audit, Authenticator)
- RDS Performance Insights (7일 보관, 무료)
- Application 로그 (Winston → CloudWatch)

### 7.3 알림 규칙

| 알림 | 조건 | 심각도 | 채널 |
|------|------|--------|------|
| **Pod Crash** | Pod 재시작 > 3회/5분 | Critical | Slack #alarm |
| **높은 CPU** | CPU > 80% (5분 지속) | Warning | Slack #alarm |
| **높은 메모리** | Memory > 85% (5분 지속) | Warning | Slack #alarm |
| **API 에러율** | 5xx 에러 > 5% (3분 지속) | Critical | Slack #alarm |
| **큐 적체** | Redis 큐 > 500개 (10분 지속) | Warning | Slack #alarm |
| **디스크 부족** | RDS 디스크 > 80% | Warning | Slack #alarm |

---

## 8️⃣ CI/CD 파이프라인

### 8.1 GitHub Actions 워크플로우

**트리거**: `main` 브랜치 Push

**파이프라인 단계**:
```yaml
[1] Checkout Code
     ↓
[2] AWS 인증 (OIDC)
     ↓
[3] ECR 로그인
     ↓
[4] Docker 이미지 빌드
     ├ Main API
     ├ Unified Crawler
     ├ Scheduler
     ├ AI Worker
     ├ Summarize AI
     ├ Bias Analysis AI
     └ Frontend
     ↓
[5] ECR 이미지 푸시
     - latest 태그
     - {git-sha} 태그 (롤백용)
     ↓
[6] kubectl 설정
     ↓
[7] Deployment 업데이트
     - kubectl set image
     ↓
[8] Rolling Update 확인
     - kubectl rollout status (타임아웃 5분)
     ↓
[9] Slack 알림
     - 성공: #deployments
     - 실패: #alarm
```

**배포 전략**: Rolling Update (무중단)
- maxSurge: 1 (새 Pod 1개씩 추가)
- maxUnavailable: 0 (다운타임 0)

**롤백**:
```bash
# 이전 버전으로 즉시 롤백
kubectl rollout undo deployment/main-api -n fans

# 특정 버전으로 롤백
kubectl set image deployment/main-api \
  main-api=907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/fans/main-api:{git-sha}
```

---

## 9️⃣ 보안 및 네트워크

### 9.1 네트워크 구성

```
VPC: 10.0.0.0/16 (서울 리전)
├── Public Subnet (2a): 10.0.101.0/24 → ALB, NAT Gateway
├── Public Subnet (2b): 10.0.102.0/24 → ALB, NAT Gateway
├── Private Subnet (2a): 10.0.1.0/24 → EKS Worker
├── Private Subnet (2b): 10.0.2.0/24 → EKS Worker
├── Database Subnet (2a): 10.0.201.0/24 → RDS
├── Database Subnet (2b): 10.0.202.0/24 → RDS
├── ElastiCache Subnet (2a): 10.0.211.0/24 → Redis
└── ElastiCache Subnet (2b): 10.0.212.0/24 → Redis
```

### 9.2 보안 그룹 계층

```
인터넷
  ↓ (80, 443)
ALB SG (0.0.0.0/0 허용)
  ↓ (모든 포트)
EKS Node SG (ALB SG만 허용)
  ↓ (5432)
RDS SG (EKS Node SG만 허용)
  ↓ (6379)
ElastiCache SG (EKS Node SG만 허용)
```

### 9.3 IAM 및 IRSA

**주요 IAM 역할**:
1. **EKS Cluster Role**: Control Plane 권한
2. **EKS Node Role**: Worker 노드 기본 권한
3. **Karpenter IRSA**: EC2 생성/삭제, SQS 읽기
4. **EBS CSI Driver IRSA**: EBS 볼륨 관리
5. **Main API ServiceAccount**: S3 프로필 이미지 업로드

**보안 원칙**:
- 최소 권한 원칙 (Least Privilege)
- IRSA를 통한 Pod 단위 권한 부여
- Secrets Manager 통합 (향후 계획)

### 9.4 SSL/TLS 인증서

**ACM (AWS Certificate Manager)**:
- 도메인: `fans.ai.kr`, `*.fans.ai.kr`
- 검증: DNS (Route 53)
- 자동 갱신: 만료 60일 전
- 비용: 무료

**사용 위치**:
- ALB HTTPS Listener (443 포트)
- CloudFront Viewer Certificate

---

## 🔟 비용 구조

### 10.1 월간 비용 (예상)

| 항목 | 구성 | 월 비용 | 비고 |
|------|------|---------|------|
| **EKS Cluster** | Control Plane | $73 | 고정 비용 |
| **EC2 노드 (고정)** | t3.large × 2, t3a.xlarge × 2 | $240 | General + AI Workers |
| **EC2 노드 (동적)** | c5.xlarge Spot, 평균 5개 | $150 | Karpenter (70% 절감) |
| **RDS PostgreSQL** | db.t3.medium Multi-AZ | $80 | 100GB gp3 |
| **ElastiCache Redis** | cache.t3.micro Multi-AZ | $30 | 0.5GB |
| **ALB** | Application Load Balancer | $25 | 데이터 전송 포함 |
| **NAT Gateway** | 2 AZ | $70 | Multi-AZ |
| **CloudFront + S3** | CDN + 스토리지 | $20 | 정적 파일 |
| **데이터 전송** | 외부 전송 | $20 | ~500GB/월 |
| **CloudWatch** | 로그 수집 | $10 | ~2GB/월 |
| **Route 53** | DNS 호스팅 | $2 | 도메인 1개 |
| **총 월 비용** | | **$720** | 약 96만원 |

### 10.2 비용 절감 전략

#### KEDA 오토스케일링
- **기존**: AI Worker 20개 상시 운영
- **현재**: 1~20개 동적 조정
- **절감**: 월 $150 (22%)

#### Karpenter Spot 인스턴스
- **기존**: On-Demand 인스턴스
- **현재**: Spot 우선 사용 (70% 절감)
- **절감**: 월 $300

#### CloudFront 캐싱
- **효과**: 원본 서버 트래픽 80% 감소
- **절감**: 월 $50

**총 절감액**: 월 $500 (약 40%)

---

## 1️⃣1️⃣ 트러블슈팅 사례

### 사례 1: 크롤러 Pod 비정상 종료

**증상**: 크롤러 Pod가 주기적으로 재시작 (CrashLoopBackOff)

**원인 파악**:
1. Grafana에서 CPU 사용률 92%, 메모리 82% 확인
2. kubectl logs로 OOM Kill 확인
3. 특정 AI Worker가 과도한 리소스 점유

**해결**:
1. AI Worker의 리소스 요청/제한 조정
   ```yaml
   resources:
     requests:
       memory: "1Gi"
       cpu: "500m"
     limits:
       memory: "2Gi"
       cpu: "1000m"
   ```
2. Node 리소스 증설 (t3a.xlarge → t3a.2xlarge)
3. HPA 임계값 재조정 (CPU 70% → 50%)

**결과**: 서비스 정상 복구, 동일 문제 재발 방지

### 사례 2: Redis 큐 적체

**증상**: AI 처리 지연, 큐 길이 1000+ 지속

**원인 파악**:
1. Summarize AI Pod 1개가 응답 없음 (Not Ready)
2. T5 모델 로딩 실패 (메모리 부족)

**해결**:
1. Summarize AI Pod 재시작
2. 모델 캐싱 최적화 (메모리 사용량 50% 감소)
3. KEDA 스케일업 속도 향상 (stabilizationWindowSeconds: 30 → 0)

**결과**: 1시간 내 백로그 처리 완료

---

## 1️⃣2️⃣ 향후 개선 방향

### 12.1 단기 계획 (3개월)

1. **AWS X-Ray 도입**
   - 분산 추적 시스템 구축
   - API 병목 구간 식별
   - 평균 응답 시간 30% 개선 목표

2. **Secrets Manager 통합**
   - Kubernetes Secrets → AWS Secrets Manager
   - 자동 로테이션 (JWT Secret, DB Password)
   - External Secrets Operator 도입

3. **API Gateway 도입**
   - Rate Limiting (사용자당 100 req/min)
   - API Key 기반 인증
   - 외부 API 제공 (파트너사)

### 12.2 중기 계획 (6개월)

1. **Multi-Region 확장**
   - 서울 + 도쿄 리전 운영
   - CloudFront Origin Failover
   - RDS Read Replica (도쿄)

2. **Kafka + Spark 재도입**
   - AWS MSK (관리형 Kafka)
   - AWS EMR (관리형 Spark)
   - 실시간 스트림 처리 파이프라인

3. **ML Pipeline 고도화**
   - SageMaker로 모델 학습 자동화
   - A/B 테스팅 (모델 성능 비교)
   - 추천 알고리즘 정확도 20% 개선

### 12.3 장기 계획 (12개월)

1. **완전 자동화 GitOps**
   - ArgoCD 도입
   - 코드 한 줄로 인프라 배포
   - Canary/Blue-Green 자동 전환

2. **보안 강화**
   - GuardDuty (위협 탐지)
   - Security Hub (컴플라이언스)
   - AWS WAF 규칙 고도화

3. **글로벌 서비스**
   - 영문 번역 (Google Translate API)
   - 미국/유럽 사용자 대응
   - 다국어 AI 모델 (mT5)

---

## 1️⃣3️⃣ 결론

FANS는 단순한 뉴스 수집 서비스가 아니라, **AI와 클라우드 기술을 결합해 뉴스 소비 방식을 혁신한 플랫폼**입니다.

### 핵심 성과

✅ **기술적 우수성**
- 완전 자동화 파이프라인 (사람 개입 0%)
- 3단계 오토스케일링 (HPA + KEDA + Karpenter)
- Multi-AZ 고가용성 (99.9% 가동률)

✅ **비용 효율성**
- v1.0 대비 75% 메모리 절감
- KEDA로 79% Pod 비용 절감
- Spot 인스턴스로 70% EC2 비용 절감

✅ **운영 우수성**
- CI/CD 자동 배포 (GitHub Actions)
- Prometheus/Grafana 실시간 모니터링
- Slack 알림으로 신속한 장애 대응

지속적인 AI 품질 향상과 인프라 자동화를 통해, 보다 효율적이고 신뢰성 있는 뉴스 서비스를 제공할 것입니다.

---

## 1️⃣4️⃣ 부록

### 14.1 기술 스택 버전

**Frontend**:
- React: 18.2.0
- React Router: 6.8.0

**Backend**:
- Node.js: 20.19.5
- Express: 4.18.2
- TypeScript: 5.1.6
- TypeORM: 0.3.17

**AI**:
- Python: 3.10
- FastAPI: 0.104.1
- Transformers: 4.35.2
- KoNLPy: 0.6.0

**Database**:
- PostgreSQL: 15.14
- Redis: 7.0

**DevOps**:
- Docker: 24+
- Kubernetes: 1.31
- Terraform: 1.6+
- KEDA: 2.12+

### 14.2 주요 지표 요약

| 항목 | 값 |
|------|-----|
| **총 코드 라인** | ~50,000 LOC |
| **마이크로서비스** | 9개 |
| **Kubernetes Manifest** | 19개 |
| **Terraform 파일** | 15개 |
| **GitHub Actions 워크플로우** | 3개 |
| **문서 페이지** | 11개 (약 8,000 라인) |
| **총 뉴스 수집** | 21,000개 |
| **일일 처리량** | 800개 |
| **API 응답 시간** | <200ms |
| **캐시 히트율** | 70% |
| **가동률** | 99.9% |

### 14.3 문의 및 추가 정보

**프로덕션 URL**: https://www.fans.ai.kr
**GitHub**: (비공개)

**추가 문의**:
- 기술 문의: docs/README.md
- 배포 문의: docs/03_운영_및_배포_가이드.md
- 인프라 문의: docs/완벽_인프라_이해_가이드.md

---

**작성일**: 2025-11-09
**버전**: 3.0
**대상**: 외부 평가자, 협력사, 투자자
**소요 시간**: 약 30분 (읽기)

---

**End of Report**
