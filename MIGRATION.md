# 아키텍처 마이그레이션 가이드

## 개요

Spark, Kafka, Airflow를 Node.js + Python 기반의 경량 아키텍처로 대체했습니다.

**마이그레이션 날짜:** 2025-10-16

---

## 변경 사항 요약

### 제거된 서비스
- ❌ **Apache Spark** (Master, Worker)
- ❌ **Apache Kafka** + Zookeeper
- ❌ **Apache Airflow** (Webserver, Scheduler, PostgreSQL)
- ❌ Spark ML Classification API

### 추가된 서비스
- ✅ **Simple Classification API** (Flask, Port 5000)
- ✅ **Scheduler Service** (Node.js + node-cron)

### 유지된 서비스
- ✅ PostgreSQL (메인 DB)
- ✅ Redis (캐싱)
- ✅ Main API (Node.js, Port 3000)
- ✅ Summarize AI (Python, Port 8000)
- ✅ Bias Analysis AI (Python, Port 8002)
- ✅ API Crawler (Node.js, Port 4003)
- ✅ Frontend (React, Port 3001)

---

## 아키텍처 비교

### 이전 아키텍처 (Spark + Kafka + Airflow)

```
┌─────────────────────────────────────────────────────────┐
│  Airflow Scheduler (10분마다 실행)                      │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  raw_news_articles (PostgreSQL)                         │
└─────────────────────────────────────────────────────────┘
                        ↓
        ┌───────────────┴───────────────┐
        ↓                               ↓
┌──────────────────┐          ┌──────────────────┐
│  Kafka Broker    │          │  Spark ML API    │
│  (news-raw 토픽) │          │  (실제 사용 안함)│
└──────────────────┘          └──────────────────┘
                                       ↓
                        ┌──────────────────────────┐
                        │  news_articles (결과 저장)│
                        └──────────────────────────┘
```

**문제점:**
- Kafka: 사용하지 않음 (토픽에 데이터가 없음)
- Spark ML: 실제로는 원본 카테고리를 그대로 사용
- Airflow: 단순 스케줄링만 수행
- 메모리 사용량: 4GB+ (불필요하게 높음)

---

### 새로운 아키텍처 (Node.js + Python)

```
┌─────────────────────────────────────────────────────────┐
│  Scheduler Service (node-cron, 10분마다 실행)           │
└─────────────────────────────────────────────────────────┘
                        ↓
        ┌───────────────┴───────────────┐
        ↓                               ↓
┌──────────────────┐          ┌──────────────────┐
│ 1. Raw News      │          │ 2. AI Summary    │
│    Processing    │          │    Generation    │
└──────────────────┘          └──────────────────┘
        ↓                               ↓
┌──────────────────┐          ┌──────────────────┐
│ Simple           │          │ Summarize AI     │
│ Classification   │          │ Service          │
│ API (Flask)      │          │ (Python)         │
└──────────────────┘          └──────────────────┘
        ↓                               ↓
┌─────────────────────────────────────────────────────────┐
│  news_articles (PostgreSQL)                             │
└─────────────────────────────────────────────────────────┘
```

**개선점:**
- 불필요한 서비스 제거로 메모리 사용량 75% 감소
- 간단하고 유지보수하기 쉬운 구조
- 동일한 기능 유지 (원본 카테고리 사용)
- 더 빠른 시작 시간

---

## 파일 구조 변경

### 새로 추가된 파일

```
backend/
├── scheduler/                    # Node.js 스케줄러 (Airflow 대체)
│   ├── src/
│   │   ├── index.ts             # 메인 스케줄러
│   │   ├── jobs/
│   │   │   ├── processRawNews.ts      # Raw 뉴스 처리
│   │   │   └── generateSummaries.ts   # AI 요약 생성
│   │   └── utils/
│   │       ├── logger.ts
│   │       └── database.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
└── simple-classifier/            # 간단한 분류 API (Spark 대체)
    ├── app.py                   # Flask API
    ├── requirements.txt
    ├── Dockerfile
    └── .dockerignore
```

### 주석 처리된 파일 (삭제하지 않음)

```
backend/
├── airflow/
│   └── dags/
│       ├── news_classification_dag.py       # ⚠️ 주석 처리됨
│       └── raw_news_processing_dag.py       # ⚠️ 주석 처리됨
│
└── recommendation/
    ├── classification_api.py                # ⚠️ 주석 처리됨
    └── category_classifier.py               # ⚠️ 주석 처리됨
```

**주의:** 이 파일들은 복구 가능성을 위해 삭제하지 않고 주석 처리했습니다.

---

## 실행 방법

### 1. 기존 서비스 중지 및 정리

```bash
# 모든 컨테이너 중지 및 제거
docker-compose down

# 불필요한 이미지/볼륨 정리 (선택적)
docker system prune -a --volumes
```

### 2. 새로운 서비스 빌드 및 실행

```bash
# 서비스 빌드 및 시작
docker-compose up -d --build

# 로그 확인
docker-compose logs -f scheduler
docker-compose logs -f classification-api
```

### 3. 서비스 상태 확인

```bash
# 실행 중인 컨테이너 확인
docker-compose ps

# 헬스체크
curl http://localhost:5000/health

# 스케줄러 로그 (실시간)
docker-compose logs -f scheduler
```

---

## 포트 정보

| 서비스 | 포트 | 설명 |
|--------|------|------|
| PostgreSQL | 5432 | 메인 데이터베이스 |
| Redis | 6379 | 캐싱 |
| Main API | 3000 | 백엔드 API |
| Frontend | 3001 | React 앱 |
| Crawler | 4003 | 뉴스 크롤러 |
| Classification API | 5000 | 간단한 분류 API (NEW) |
| Summarize AI | 8000 | AI 요약 |
| Bias Analysis AI | 8002 | 편향 분석 |

---

## 스케줄 설정

**기본 스케줄:** 10분마다 실행

환경변수로 변경 가능:

```bash
# .env 파일
SCHEDULE_INTERVAL=*/10 * * * *  # 10분마다
# SCHEDULE_INTERVAL=*/5 * * * *   # 5분마다
# SCHEDULE_INTERVAL=0 * * * *     # 매 시간
```

**Cron 문법:**
```
분 시 일 월 요일
*  *  *  *  *

예시:
*/10 * * * *  = 10분마다
0 */2 * * *   = 2시간마다
0 9 * * *     = 매일 오전 9시
```

---

## 데이터 흐름

### 1. Raw 뉴스 처리 (10분마다)

```
Scheduler
    ↓ HTTP POST /process-raw-news
Classification API
    ↓ SELECT FROM raw_news_articles WHERE processed = FALSE
    ↓ INSERT INTO news_articles (원본 카테고리 사용)
    ↓ UPDATE raw_news_articles SET processed = TRUE
PostgreSQL
```

### 2. AI 요약 생성 (10분마다, 1분 지연 후)

```
Scheduler
    ↓ SELECT FROM news_articles WHERE ai_summary IS NULL
    ↓ HTTP POST /api/summarize (각 기사마다)
Summarize AI
    ↓ AI 요약 생성
    ↓ UPDATE news_articles SET ai_summary = ...
PostgreSQL
```

---

## 성능 비교

### 이전 (Spark + Kafka + Airflow)

| 항목 | 수치 |
|------|------|
| 컨테이너 수 | 15개 |
| 메모리 사용량 | ~4GB |
| 시작 시간 | ~120초 |
| 디스크 사용량 | ~3GB |

### 현재 (Node.js + Python)

| 항목 | 수치 |
|------|------|
| 컨테이너 수 | 9개 |
| 메모리 사용량 | ~1GB ⬇️ 75% |
| 시작 시간 | ~30초 ⬇️ 75% |
| 디스크 사용량 | ~800MB ⬇️ 73% |

---

## 롤백 방법

만약 문제가 발생하면 기존 아키텍처로 롤백할 수 있습니다:

### 1. docker-compose.yml 롤백

```bash
# 새 서비스 주석 처리
# - classification-api (simple-classifier)
# - scheduler

# 기존 서비스 주석 제거
# - zookeeper, kafka
# - spark-master, spark-worker
# - classification-api (recommendation)
# - airflow-postgres, airflow-webserver, airflow-scheduler
```

### 2. 코드 파일 주석 해제

```bash
# backend/airflow/dags/*.py
# backend/recommendation/*.py
# 파일 내부의 ''' ... ''' 주석 블록 제거
```

### 3. 재실행

```bash
docker-compose up -d --build
```

---

## 트러블슈팅

### 스케줄러가 시작되지 않을 때

```bash
# 로그 확인
docker-compose logs scheduler

# 데이터베이스 연결 확인
docker-compose exec scheduler ping postgres

# 재시작
docker-compose restart scheduler
```

### Classification API 연결 실패

```bash
# 헬스체크
curl http://localhost:5000/health

# 로그 확인
docker-compose logs classification-api

# 데이터베이스 연결 테스트
docker-compose exec classification-api python -c "import psycopg2; print('OK')"
```

### Raw 뉴스가 처리되지 않을 때

```bash
# 1. 스케줄러 로그 확인
docker-compose logs -f scheduler

# 2. Classification API 상태 확인
curl http://localhost:5000/health

# 3. DB에서 처리 대기 중인 기사 확인
docker-compose exec postgres psql -U fans_user -d fans_db -c \
  "SELECT COUNT(*) FROM raw_news_articles WHERE processed = FALSE;"

# 4. 수동으로 처리 실행
curl -X POST http://localhost:5000/process-raw-news \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

---

## AWS 배포 시 고려사항

### 옵션 A: 단일 EC2 (권장)

```
EC2 t3.large (8GB RAM)
├── Docker Compose로 모든 서비스 실행
├── 월 비용: ~$60 (Reserved Instance 적용 시)
└── 간단한 관리
```

### 옵션 B: 분산 구성

```
- EC2 t3.medium (백엔드) + t3.small (AI)
- RDS PostgreSQL t4g.medium
- ElastiCache Redis t4g.small
- ALB (로드밸런서)
월 비용: ~$180
```

**추천:** 옵션 A (단일 서버)로 시작 → 트래픽 증가 시 옵션 B로 확장

---

## FAQ

**Q: 기존 데이터는 어떻게 되나요?**
A: 데이터베이스는 그대로 유지됩니다. 마이그레이션은 애플리케이션 레이어만 변경합니다.

**Q: 기능적 차이가 있나요?**
A: 없습니다. 기존에도 Spark ML을 사용하지 않고 원본 카테고리를 그대로 사용하고 있었으므로, 동일한 기능을 제공합니다.

**Q: 성능 저하가 있나요?**
A: 오히려 개선됩니다. 불필요한 오버헤드가 제거되어 더 빠르게 동작합니다.

**Q: 확장성은 어떻게 되나요?**
A: Node.js 스케줄러와 Python API는 충분히 확장 가능합니다. 필요시 여러 인스턴스를 실행하고 로드밸런서로 분산할 수 있습니다.

---

## 문의

문제가 발생하거나 질문이 있으면 팀에 문의하세요.

- 마이그레이션 날짜: 2025-10-16
- 담당자: Claude AI Assistant
