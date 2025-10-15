# FANS 프로젝트 빌드 및 실행 가이드

## 📋 목차
1. [사전 요구사항](#사전-요구사항)
2. [프로젝트 클론](#프로젝트-클론)
3. [환경 설정](#환경-설정)
4. [데이터베이스 초기화](#데이터베이스-초기화)
5. [서비스 빌드 및 실행](#서비스-빌드-및-실행)
6. [프론트엔드 실행](#프론트엔드-실행)
7. [검증](#검증)
8. [문제 해결](#문제-해결)

---

## 사전 요구사항

다음 소프트웨어가 설치되어 있어야 합니다:

- **Docker**: 20.10 이상
- **Docker Compose**: 2.0 이상
- **Node.js**: 20.x 이상
- **npm**: 9.x 이상
- **Git**: 최신 버전

### 설치 확인
```bash
docker --version
docker compose version
node --version
npm --version
```

---

## 프로젝트 클론

```bash
git clone <repository-url>
cd FANS
```

---

## 환경 설정

### 1. 환경 변수 파일 확인

프로젝트 루트에 `.env` 파일이 있는지 확인합니다. 없다면 아래 내용으로 생성:

```bash
# .env 파일 내용은 이미 준비되어 있습니다
# 필요시 다음 값들을 수정하세요:
# - POSTGRES_PASSWORD
# - JWT_SECRET
# - SESSION_SECRET
# - API Keys (Naver, Kakao)
```

**중요:** `.env` 파일의 API 키들은 실제 운영 환경에서 반드시 변경해야 합니다.

---

## 데이터베이스 초기화

### 데이터베이스 스키마 확인

`/backend/database/init.sql` 파일에 모든 테이블과 초기 데이터가 정의되어 있습니다:

- 21개 테이블
- 인덱스, 트리거, 뷰
- 초기 데이터 (카테고리, 언론사, 증시 샘플 데이터)

**중요한 스키마 정보:**
- `bias_analysis` 테이블: `bias_score`와 `confidence`는 `NUMERIC(5,2)` (0-100 값 지원)
- `sources` 테이블: `id`는 수동 지정 (OID 기반)
- `raw_news_articles` 테이블: 크롤링 원본 저장용

---

## 서비스 빌드 및 실행

### 1. 모든 볼륨 및 컨테이너 정리 (선택사항 - 완전 초기화 시)

```bash
# 기존 컨테이너 및 볼륨 삭제
docker compose down -v
docker volume prune -f
```

### 2. 서비스 빌드 및 시작

```bash
# 모든 서비스 빌드 및 시작
docker compose up -d --build
```

### 3. 서비스 시작 확인

```bash
# 컨테이너 상태 확인
docker compose ps

# 모든 서비스가 'Up' 또는 'healthy' 상태여야 합니다
```

**시작되는 서비스 (총 18개):**
- PostgreSQL (fans_postgres)
- Redis (fans_redis)
- Kafka + Zookeeper
- Spark Master + Worker
- Airflow (Postgres, Webserver, Scheduler)
- Summarize AI (fans_summarize_ai)
- Bias Analysis AI (fans_bias_analysis_ai)
- API Crawler (fans_api_crawler)
- Puppeteer Crawler 1, 2, 3 (fans_puppeteer_crawler_1/2/3)
- Classification API (fans_classification_api)
- Main API (fans_main_api)

**주의:** 프론트엔드는 Docker에서 실행하지 않습니다!

### 4. 로그 확인

```bash
# 전체 로그 확인
docker compose logs -f

# 특정 서비스 로그 확인
docker compose logs -f postgres
docker compose logs -f main-api
docker compose logs -f api-crawler
```

### 5. 데이터베이스 초기화 확인

```bash
# PostgreSQL 접속하여 테이블 확인
docker exec -it fans_postgres psql -U fans_user -d fans_db

# psql 내부에서:
\dt                           # 테이블 목록 확인 (21개)
\d bias_analysis             # bias_analysis 스키마 확인
SELECT COUNT(*) FROM sources;  # 언론사 데이터 확인 (15개)
SELECT COUNT(*) FROM categories; # 카테고리 확인 (8개)
\q                           # 종료
```

---

## 프론트엔드 실행

**중요:** 프론트엔드는 로컬에서 실행해야 합니다!

### 1. 의존성 설치

```bash
cd frontend
npm install
```

### 2. 프론트엔드 시작

```bash
PORT=3001 npm start
```

프론트엔드가 `http://localhost:3001`에서 실행됩니다.

### 3. 프록시 설정 확인

`frontend/src/setupProxy.js` 파일이 다음과 같이 설정되어 있어야 합니다:

```javascript
const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
```

---

## 검증

### 1. 헬스체크

```bash
# Main API 헬스체크
curl http://localhost:3000/health

# Summarize AI 헬스체크
curl http://localhost:8000/health

# Bias Analysis AI 헬스체크
curl http://localhost:8002/health
```

### 2. API 테스트

```bash
# 카테고리 조회
curl http://localhost:3000/api/common/categories

# 언론사 조회
curl http://localhost:3000/api/common/media-sources

# 뉴스 피드 조회
curl "http://localhost:3000/api/feed?limit=10"
```

### 3. 데이터 수집 확인

```bash
# 크롤링된 뉴스 개수 확인
docker exec fans_postgres psql -U fans_user -d fans_db -c "SELECT COUNT(*) FROM news_articles;"
docker exec fans_postgres psql -U fans_user -d fans_db -c "SELECT COUNT(*) FROM raw_news_articles;"
```

### 4. 프론트엔드 접속

브라우저에서 `http://localhost:3001` 접속하여 확인:
- 뉴스 목록 표시
- 로그인/회원가입 가능
- 뉴스 상세 페이지 접근

---

## 문제 해결

### 1. PostgreSQL 연결 오류

**증상:** "relation does not exist" 에러

**해결:**
```bash
# 컨테이너 재시작
docker compose restart postgres

# 로그 확인
docker compose logs postgres | grep ERROR
```

### 2. Bias Analysis NUMERIC 오버플로우

**증상:** "numeric field overflow" 에러

**원인:** 엔티티 파일의 precision이 3인 경우

**확인:**
```bash
# Backend API 엔티티
grep -n "precision" backend/api/src/entities/BiasAnalysis.ts

# Crawler 엔티티
grep -n "precision" backend/crawler/shared/entities/BiasAnalysis.ts
```

**수정:**
두 파일 모두 `precision: 5, scale: 2`로 설정되어야 합니다.

### 3. 프론트엔드 504 Gateway Timeout

**증상:** API 호출 시 504 에러

**원인:** 프론트엔드가 Docker에서 실행 중이거나 API URL이 잘못됨

**해결:**
1. 프론트엔드는 반드시 로컬에서 실행
2. `.env` 파일 확인:
   ```
   REACT_APP_API_BASE=http://localhost:3000
   REACT_APP_API_URL=http://localhost:3000/api
   ```

### 4. Source ID NULL 제약 조건 위반

**증상:** "null value in column "id" of relation "sources""

**원인:** 새로운 언론사가 자동 생성되려 할 때 발생

**해결:**
```bash
# sources 테이블에 수동으로 추가
docker exec fans_postgres psql -U fans_user -d fans_db -c \
  "INSERT INTO sources (id, name) VALUES (999, '새언론사') ON CONFLICT (id) DO NOTHING;"
```

### 5. 이미지가 표시되지 않음

**증상:** 뉴스 목록에서 이미지 미표시

**원인:** `raw_news_articles`에서 `news_articles`로 이미지가 복사되지 않음

**해결:**
```bash
# 이미지 동기화
docker exec fans_postgres psql -U fans_user -d fans_db << 'EOF'
UPDATE news_articles n
SET image_url = r.image_url
FROM raw_news_articles r
WHERE n.url = r.url
  AND n.image_url IS NULL
  AND r.image_url IS NOT NULL;
EOF
```

### 6. 서비스 재시작

특정 서비스만 재시작:
```bash
docker compose restart main-api
docker compose restart api-crawler
docker compose restart bias-analysis-ai
```

전체 재시작:
```bash
docker compose restart
```

---

## 포트 매핑

| 서비스 | 포트 | 설명 |
|--------|------|------|
| Frontend | 3001 | React 프론트엔드 (로컬) |
| Main API | 3000 | 메인 백엔드 API |
| PostgreSQL | 5432 | 데이터베이스 |
| Redis | 6379 | 캐시 |
| Summarize AI | 8000 | AI 요약 서비스 |
| Bias Analysis AI | 8002 | 편향 분석 AI |
| Spark Master UI | 8080 | Spark 관리 UI |
| Spark Worker UI | 8082 | Spark Worker UI |
| Airflow UI | 8081 | Airflow 관리 UI |
| Kafka | 9092 | 메시지 큐 |
| API Crawler | 4003 | API 크롤러 |
| Puppeteer Crawler 1 | 4004 | Puppeteer 크롤러 1 |
| Puppeteer Crawler 2 | 4005 | Puppeteer 크롤러 2 |
| Puppeteer Crawler 3 | 4006 | Puppeteer 크롤러 3 |
| Classification API | 5000 | Spark ML 분류 API |

---

## 주요 디렉토리 구조

```
FANS/
├── backend/
│   ├── api/                    # 메인 API (NestJS)
│   │   └── src/entities/       # TypeORM 엔티티
│   ├── ai/
│   │   ├── summarize-ai/       # AI 요약 서비스 (Python)
│   │   └── bias-analysis-ai/   # 편향 분석 AI (Python)
│   ├── crawler/
│   │   ├── api-crawler/        # API 기반 크롤러
│   │   ├── puppeteer-crawler/  # Puppeteer 크롤러
│   │   └── shared/entities/    # 공통 엔티티
│   ├── database/
│   │   ├── init.sql           # 데이터베이스 초기화 스크립트 ⭐
│   │   └── migrations/         # 추가 마이그레이션 (병합됨)
│   ├── recommendation/         # Spark ML 추천 시스템
│   └── airflow/               # Airflow DAGs
├── frontend/                   # React 프론트엔드
│   └── src/
│       ├── pages/
│       ├── components/
│       └── setupProxy.js      # API 프록시 설정
├── docker-compose.yml         # Docker Compose 설정 ⭐
├── .env                       # 환경 변수 ⭐
├── CLAUDE.md                  # 개발 메모
└── SETUP.md                   # 이 파일

⭐ = 빌드 시 반드시 확인 필요
```

---

## 추가 참고사항

### 자동 크롤링

- API Crawler: 5분마다 자동 실행
- Puppeteer Crawler: 3분(180초)마다 자동 실행
- 총 3개의 Puppeteer 인스턴스가 로드 밸런싱

### 데이터베이스 백업

```bash
# 백업
docker exec fans_postgres pg_dump -U fans_user fans_db > backup.sql

# 복원
docker exec -i fans_postgres psql -U fans_user fans_db < backup.sql
```

### 개발 모드

`NODE_ENV=development`로 설정되어 있어 상세한 로그가 출력됩니다.

---

## 성공적인 빌드 체크리스트

- [ ] Docker 컨테이너 18개 모두 실행 중
- [ ] PostgreSQL 테이블 21개 생성 확인
- [ ] 카테고리 8개, 언론사 15개 초기 데이터 확인
- [ ] Main API 헬스체크 성공 (http://localhost:3000/health)
- [ ] 프론트엔드 접속 가능 (http://localhost:3001)
- [ ] 뉴스 크롤링 시작 확인 (raw_news_articles 테이블에 데이터 추가)
- [ ] 로그인/회원가입 기능 작동

---

**빌드 성공 후 예상 결과:**
- 5-10분 내에 첫 뉴스 수집 시작
- 뉴스 피드에 기사 표시
- 편향 분석 및 AI 요약 자동 생성

문제가 발생하면 이 문서의 [문제 해결](#문제-해결) 섹션을 참고하세요.
