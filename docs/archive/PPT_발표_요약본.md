# FANS - AI 뉴스 큐레이션 플랫폼 (발표용 요약)

---

## 1️⃣ 프로젝트 소개

### 🎯 목표
- **신뢰할 수 있는 뉴스 제공**
- **AI 기반 편향성 분석**
- **개인화 뉴스 추천**

### 💡 핵심 기능
1. **자동 뉴스 수집** (3분마다)
2. **AI 요약 생성** (100자)
3. **편향성 분석** (감성, 정치 성향)
4. **카테고리 자동 분류** (8개)

---

## 2️⃣ 기술 스택

### Frontend
- **React 18** + JavaScript
- **Axios** (HTTP)
- **React Router** (라우팅)

### Backend
- **Node.js** + **TypeScript 5.9**
- **Express.js** 4.21
- **TypeORM** (ORM)
- **JWT** + **bcrypt** (인증)

### Database
- **PostgreSQL 15** (메인 DB)
- **Redis 7** (캐시, 세션)

### AI/ML
- **Python 3.10** + **FastAPI**
- **T5** (한국어 요약)
- **KoBERT** (감성 분석)
- **Random Forest** (카테고리 분류)

### OAuth
- **카카오 로그인**
- **네이버 로그인**

---

## 3️⃣ 시스템 아키텍처

```
React (3001) → Node.js API (3000) → PostgreSQL (5432)
                    ↓
        ┌──────────┼──────────┐
        ↓          ↓          ↓
    요약 AI    편향 AI    분류 AI
    (8000)    (8002)    (5000)
```

---

## 4️⃣ 뉴스 크롤링 시스템

### 📊 수집 규모

| 항목 | 수치 |
|------|------|
| **크롤링 주기** | **3분마다** |
| **카테고리** | **8개** (정치/경제/사회/세계/IT/생활/스포츠/연예) |
| **1회 수집량** | **40개** (카테고리당 5개) |
| **시간당** | **800개** |
| **일일 수집** | **19,200개** |

### 🔄 처리 프로세스

#### ① 원본 수집 (3분마다)
```
Daum News → HTML 파싱 → raw_news_articles 저장
```
- **소스**: Daum News (공식 뉴스 포털)
- **검증**: 중복 체크, 콘텐츠 유효성 검사
- **인코딩**: EUC-KR, UTF-8 자동 처리

#### ② AI 처리 (10분마다)
```
Raw News → 분류 AI → 요약 AI → 키워드 → 편향 분석
```
1. **카테고리 분류** (0분)
2. **AI 요약 생성** (1분 후)
3. **키워드 추출** (2분 후)
4. **편향 분석** (3분 후)

### 🎯 신뢰성

✅ **공식 뉴스 포털** (Daum News)
✅ **중복 방지** (URL 기반)
✅ **콘텐츠 검증** (최소 50자, 한글 30%)
✅ **요청 간격** (1~2초 대기)

---

## 5️⃣ AI 서비스

### 1. 요약 AI (Port 8000)
- **모델**: T5 한국어 특화
- **입력**: 기사 본문
- **출력**: 100자 요약
- **성능**: 1~2초/기사

### 2. 편향 분석 AI (Port 8002)
- **모델**: KoBERT
- **분석 항목**:
  - 감성 분석 (긍정/부정/중립)
  - 정치 성향 (진보/보수/중도)
  - 키워드 추출 (상위 10개)

### 3. 카테고리 분류 AI (Port 5000)
- **모델**: Random Forest
- **정확도**: 85~90%
- **카테고리**: 8개 자동 분류

---

## 6️⃣ 주요 기능

### 🔐 인증 시스템
- **일반 로그인** (이메일/비밀번호)
- **소셜 로그인** (카카오/네이버)
- **계정 연동** (일반 ↔ 소셜)
- **JWT 토큰** (유효기간 1~30일)

### 📰 뉴스 기능
- **실시간 피드** (페이지네이션)
- **카테고리별 조회**
- **검색** (제목/내용)
- **인기 뉴스**

### 👤 개인화
- **맞춤 추천** (읽기 기록 기반)
- **북마크**
- **조회 기록**
- **댓글**

---

## 7️⃣ API 명세

### 주요 엔드포인트 (총 2,694줄)

```
[뉴스]
GET  /api/news/feed           # 피드
GET  /api/news/:id            # 상세
GET  /api/news/search         # 검색

[인증]
POST /api/auth/register       # 회원가입
POST /api/auth/login          # 로그인
GET  /api/auth/kakao          # 카카오 로그인
GET  /api/auth/naver          # 네이버 로그인

[추천]
GET  /api/recommendations/personalized  # 맞춤 추천

[댓글]
GET  /api/comments/:articleId # 댓글 조회
POST /api/comments            # 댓글 작성
```

---

## 8️⃣ 데이터베이스

### 주요 테이블
```sql
users              -- 사용자 (소셜 로그인 지원)
news_articles      -- 최종 뉴스 (AI 처리 완료)
raw_news_articles  -- 원본 뉴스 (처리 대기)
bias_analysis      -- 편향 분석 결과
keywords           -- 키워드
user_actions       -- 사용자 행동 (조회/북마크)
comments           -- 댓글
```

---

## 9️⃣ 배포 환경

### Docker Compose (12개 컨테이너)
```
postgres              # PostgreSQL DB
redis                 # Redis 캐시
main-api              # Node.js API
frontend              # React
api-crawler           # 뉴스 크롤러
puppeteer-crawler×3   # 병렬 크롤링
scheduler             # 작업 스케줄러
summarize-ai          # 요약 AI
bias-analysis-ai      # 편향 AI
classification-api    # 분류 AI
```

### 포트 구성
```
3000  Main API
3001  Frontend
5000  Classification AI
5432  PostgreSQL
6379  Redis
8000  Summarize AI
8002  Bias Analysis AI
```

---

## 🔟 성능 지표

### 처리량
- **일일 수집**: 19,200개
- **AI 처리**: 10분 배치
- **응답 시간**: < 200ms

### 확장성
- **동시 접속**: 500+
- **수평 확장**: AI 서버 복제 가능
- **캐싱**: Redis 활용

---

## 1️⃣1️⃣ 개발 특이사항

### 아키텍처 변경
```
AS-IS: Spark + Kafka + Airflow
  ↓ (메모리 75% 절감)
TO-BE: Node.js + Python + Cron
```

### 기술 선택 이유
- **TypeScript**: 타입 안전성
- **FastAPI**: 고속 AI 처리
- **PostgreSQL**: JSONB 지원
- **Docker**: 배포 편의성

---

## 1️⃣2️⃣ 향후 계획

### 단기
- Elasticsearch 검색 엔진
- Redis 캐싱 확대
- 프론트엔드 최적화

### 중기
- 실시간 알림 (WebSocket)
- 모바일 앱
- AI 추천 고도화

### 장기
- Kubernetes 배포
- CI/CD 자동화
- 다국어 지원

---

## 📌 핵심 강점

### ✅ 자동화
- 3분마다 자동 크롤링
- 10분마다 AI 처리
- 수동 개입 최소화

### ✅ 신뢰성
- 공식 뉴스 포털 (Daum)
- 중복 방지
- 콘텐츠 검증

### ✅ AI 활용
- 한국어 특화 모델 (T5, KoBERT)
- 3단계 AI 처리
- 편향성 분석

### ✅ 사용자 경험
- 소셜 로그인 (카카오/네이버)
- 개인화 추천
- 직관적 UI

---

**개발 기간**: 2025.09 ~ 2025.10
**팀 구성**: 협업 프로젝트
**기술 스택**: React + Node.js + Python + PostgreSQL
**컨테이너**: Docker Compose (12개)
