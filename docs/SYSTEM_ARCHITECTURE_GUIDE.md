# 📚 FANS 시스템 아키텍처 가이드
**작성일**: 2025-09-21
**용도**: 데이터베이스, 엔티티, API 구조 및 파일 위치 안내

---

## 🗄️ 데이터베이스 구조

### PostgreSQL 데이터베이스 정보
- **Host**: localhost (Docker: postgres)
- **Port**: 5432
- **Database**: fans_db
- **User**: fans_user
- **Password**: fans_password

### 테이블 구조 (13개)

#### 1. `users` - 사용자 정보
| 컬럼명 | 타입 | 제약조건 | 설명 | 저장 예시 |
|--------|------|----------|------|-----------|
| `id` | BIGINT | PK, AUTO_INCREMENT | 사용자 고유 ID | 1, 2, 3... |
| `username` | VARCHAR(50) | UNIQUE, NOT NULL | 사용자명 | "john_doe", "user123" |
| `email` | VARCHAR(100) | UNIQUE, NOT NULL | 이메일 주소 | "user@example.com" |
| `password_hash` | VARCHAR(255) | NOT NULL | 암호화된 비밀번호 | "$2b$10$xyz..." |
| `user_name` | VARCHAR(100) | NULLABLE | 실명/닉네임 | "홍길동", "John Doe" |
| `tel` | VARCHAR(20) | NULLABLE | 전화번호 | "010-1234-5678" |
| `profile_image` | VARCHAR(500) | NULLABLE | 프로필 이미지 경로 | "/uploads/profiles/user1.jpg" |
| `active` | BOOLEAN | DEFAULT true | 계정 활성화 상태 | true, false |
| `provider` | VARCHAR(20) | DEFAULT 'local' | 로그인 제공자 | "local", "kakao", "naver" |
| `social_token` | VARCHAR(500) | NULLABLE | 소셜 로그인 토큰 | "eyJhbGciOiJIUzI1..." |
| `previous_pw` | VARCHAR(255) | NULLABLE | 이전 비밀번호 해시 | "$2b$10$abc..." |
| `last_login` | TIMESTAMPTZ | NULLABLE | 마지막 로그인 시간 | "2025-01-15 10:30:00+09" |
| `created_at` | TIMESTAMPTZ | NOT NULL | 계정 생성일 | "2025-01-01 09:00:00+09" |
| `updated_at` | TIMESTAMPTZ | NOT NULL | 정보 수정일 | "2025-01-15 14:20:00+09" |

#### 2. `user_preferences` - 사용자 선호도
| 컬럼명 | 타입 | 제약조건 | 설명 | 저장 예시 |
|--------|------|----------|------|-----------|
| `user_id` | BIGINT | PK, FK | 사용자 ID | 1, 2, 3... |
| `preferred_categories` | JSONB | NULLABLE | 선호 카테고리 배열 | [1, 3, 5] (카테고리 ID) |
| `preferred_keywords` | JSONB | NULLABLE | 선호 키워드 배열 | ["정치", "경제", "IT"] |
| `preferred_sources` | JSONB | NULLABLE | 구독 언론사 배열 | [1, 4, 7] (언론사 ID) |
| `age` | INT | NULLABLE | 연령 | 25, 30, 45 |
| `gender` | VARCHAR(10) | NULLABLE | 성별 | "male", "female", "other" |
| `location` | VARCHAR(100) | NULLABLE | 지역 | "서울", "부산", "경기도" |
| `avg_reading_time` | INT | NULLABLE | 평균 읽기 시간(초) | 120, 300, 180 |
| `preferred_time_slots` | JSONB | NULLABLE | 선호 시간대 | ["09:00-12:00", "18:00-21:00"] |
| `updated_at` | TIMESTAMPTZ | NOT NULL | 마지막 업데이트 | "2025-01-15 16:45:00+09" |

#### 3. `user_actions` - 사용자 행동 추적
| 컬럼명 | 타입 | 제약조건 | 설명 | 저장 예시 |
|--------|------|----------|------|-----------|
| `id` | BIGINT | PK, AUTO_INCREMENT | 행동 기록 ID | 1, 2, 3... |
| `user_id` | BIGINT | FK, NOT NULL | 사용자 ID | 1, 2, 3... |
| `article_id` | BIGINT | FK, NOT NULL | 기사 ID | 100, 101, 102... |
| `action_type` | VARCHAR(20) | NOT NULL | 행동 유형 | "VIEW", "LIKE", "DISLIKE", "BOOKMARK", "COMMENT" |
| `reading_duration` | INT | NULLABLE | 읽기 시간(초) | 45, 120, 300 |
| `reading_percentage` | INT | NULLABLE | 읽기 진행률(%) | 25, 80, 100 |
| `weight` | DOUBLE | DEFAULT 1.0 | 가중치 | 1.0, 1.5, 0.8 |
| `created_at` | TIMESTAMPTZ | NOT NULL | 행동 시간 | "2025-01-15 14:30:00+09" |

#### 4. `bookmarks` - 북마크 관리
| 컬럼명 | 타입 | 제약조건 | 설명 | 저장 예시 |
|--------|------|----------|------|-----------|
| `id` | BIGINT | PK, AUTO_INCREMENT | 북마크 ID | 1, 2, 3... |
| `user_id` | BIGINT | FK, NOT NULL | 사용자 ID | 1, 2, 3... |
| `news_id` | BIGINT | FK, NOT NULL | 기사 ID | 100, 101, 102... |
| `created_at` | TIMESTAMPTZ | NOT NULL | 북마크 생성일 | "2025-01-15 15:20:00+09" |

#### 5. `news_articles` - 뉴스 기사
| 컬럼명 | 타입 | 제약조건 | 설명 | 저장 예시 |
|--------|------|----------|------|-----------|
| `id` | BIGINT | PK, AUTO_INCREMENT | 기사 고유 ID | 1, 2, 3... |
| `title` | VARCHAR(500) | NOT NULL | 기사 제목 | "정부, 새로운 정책 발표" |
| `content` | TEXT | NULLABLE | 기사 본문 | "오늘 정부는 새로운 정책을..." |
| `ai_summary` | TEXT | NULLABLE | AI 요약문 | "정부가 발표한 새 정책의 핵심은..." |
| `url` | VARCHAR(1000) | UNIQUE, NULLABLE | 원본 기사 URL | "https://news.example.com/article/123" |
| `image_url` | VARCHAR(1000) | NULLABLE | 대표 이미지 URL | "https://img.example.com/news123.jpg" |
| `source_id` | BIGINT | FK, NOT NULL | 언론사 ID | 1, 2, 3... |
| `category_id` | BIGINT | FK, NOT NULL | 카테고리 ID | 1, 2, 3... |
| `journalist` | VARCHAR(100) | NULLABLE | 기자명 | "홍길동 기자", "Jane Smith" |
| `pub_date` | TIMESTAMPTZ | NULLABLE | 발행일시 | "2025-01-15 09:30:00+09" |
| `search_vector` | TSVECTOR | NULLABLE | 검색 벡터 (PostgreSQL FTS) | 'government':1 'policy':2... |
| `created_at` | TIMESTAMPTZ | NOT NULL | 크롤링 시간 | "2025-01-15 10:00:00+09" |
| `updated_at` | TIMESTAMPTZ | NOT NULL | 수정 시간 | "2025-01-15 10:30:00+09" |

#### 6. `sources` - 언론사 정보
| 컬럼명 | 타입 | 제약조건 | 설명 | 저장 예시 |
|--------|------|----------|------|-----------|
| `id` | BIGINT | PK, AUTO_INCREMENT | 언론사 ID | 1, 2, 3... |
| `name` | VARCHAR(100) | UNIQUE, NOT NULL | 언론사명 | "연합뉴스", "조선일보", "한겨레" |
| `logo_url` | VARCHAR(500) | NULLABLE | 로고 이미지 URL | "/logos/yonhap.png" |

#### 7. `categories` - 카테고리
| 컬럼명 | 타입 | 제약조건 | 설명 | 저장 예시 |
|--------|------|----------|------|-----------|
| `id` | BIGINT | PK, AUTO_INCREMENT | 카테고리 ID | 1, 2, 3... |
| `name` | VARCHAR(50) | UNIQUE, NOT NULL | 카테고리명 | "정치", "경제", "사회", "IT" |

#### 8. `keywords` - 키워드
| 컬럼명 | 타입 | 제약조건 | 설명 | 저장 예시 |
|--------|------|----------|------|-----------|
| `id` | BIGINT | PK, AUTO_INCREMENT | 키워드 ID | 1, 2, 3... |
| `keyword` | VARCHAR(100) | UNIQUE, NOT NULL | 키워드 | "정부", "정책", "경제성장" |
| `frequency` | INT | DEFAULT 1 | 출현 빈도 | 1, 25, 150 |
| `created_at` | TIMESTAMPTZ | NOT NULL | 생성일 | "2025-01-15 10:00:00+09" |

#### 9. `news_keywords` - 뉴스-키워드 연결 (M:N)
| 컬럼명 | 타입 | 제약조건 | 설명 | 저장 예시 |
|--------|------|----------|------|-----------|
| `news_id` | BIGINT | PK, FK | 기사 ID | 100, 101, 102... |
| `keyword_id` | BIGINT | PK, FK | 키워드 ID | 1, 2, 3... |
| `relevance` | DOUBLE | DEFAULT 1.0 | 연관도 점수 | 0.8, 1.0, 1.5 |

#### 10. `article_stats` - 기사 통계
| 컬럼명 | 타입 | 제약조건 | 설명 | 저장 예시 |
|--------|------|----------|------|-----------|
| `article_id` | BIGINT | PK, FK | 기사 ID | 100, 101, 102... |
| `view_count` | BIGINT | DEFAULT 0 | 조회수 | 0, 150, 1200 |
| `like_count` | BIGINT | DEFAULT 0 | 좋아요 수 | 0, 15, 45 |
| `dislike_count` | BIGINT | DEFAULT 0 | 싫어요 수 | 0, 3, 8 |
| `bookmark_count` | BIGINT | DEFAULT 0 | 북마크 수 | 0, 25, 67 |
| `comment_count` | BIGINT | DEFAULT 0 | 댓글 수 | 0, 12, 34 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | 통계 업데이트 시간 | "2025-01-15 16:00:00+09" |

#### 11. `ai_recommendations` - AI 추천
| 컬럼명 | 타입 | 제약조건 | 설명 | 저장 예시 |
|--------|------|----------|------|-----------|
| `id` | BIGINT | PK, AUTO_INCREMENT | 추천 ID | 1, 2, 3... |
| `user_id` | BIGINT | FK, NOT NULL | 사용자 ID | 1, 2, 3... |
| `article_id` | BIGINT | FK, NOT NULL | 기사 ID | 100, 101, 102... |
| `recommendation_score` | DECIMAL(4,2) | NOT NULL | 추천 점수 | 0.85, 0.92, 0.76 |
| `recommendation_reason` | JSONB | NULLABLE | 추천 이유 | {"keywords": ["경제"], "similarity": 0.9} |
| `model_version` | VARCHAR(20) | NULLABLE | 모델 버전 | "v1.0", "v2.1" |
| `was_clicked` | BOOLEAN | DEFAULT false | 클릭 여부 | true, false |
| `was_read` | BOOLEAN | DEFAULT false | 읽기 여부 | true, false |
| `feedback_score` | INT | NULLABLE | 피드백 점수 | -1, 0, 1 |
| `created_at` | TIMESTAMPTZ | NOT NULL | 추천 생성일 | "2025-01-15 09:00:00+09" |

#### 12. `bias_analysis` - 편향성 분석
| 컬럼명 | 타입 | 제약조건 | 설명 | 저장 예시 |
|--------|------|----------|------|-----------|
| `id` | BIGINT | PK, AUTO_INCREMENT | 분석 ID | 1, 2, 3... |
| `article_id` | BIGINT | UNIQUE, FK | 기사 ID | 100, 101, 102... |
| `source_id` | BIGINT | FK, NULLABLE | 언론사 ID | 1, 2, 3... |
| `journalist` | VARCHAR(100) | NULLABLE | 기자명 | "홍길동 기자" |
| `political_bias` | DECIMAL(3,1) | NULLABLE | 정치적 편향 (-5.0~5.0) | -2.1, 0.0, 3.4 |
| `economic_bias` | DECIMAL(3,1) | NULLABLE | 경제적 편향 (-5.0~5.0) | -1.5, 1.8, 0.2 |
| `social_bias` | DECIMAL(3,1) | NULLABLE | 사회적 편향 (-5.0~5.0) | 0.5, -3.2, 2.1 |
| `confidence_level` | DECIMAL(3,2) | NULLABLE | 신뢰도 (0.0~1.0) | 0.85, 0.92, 0.76 |
| `analysis_method` | VARCHAR(50) | NULLABLE | 분석 방법 | "ML_v1", "rule_based" |
| `sample_size` | INT | NULLABLE | 샘플 크기 | 100, 500, 1000 |
| `analysis_data` | JSONB | NULLABLE | 분석 상세 데이터 | {"sentiment": 0.2, "topics": [...]} |
| `analyzed_at` | TIMESTAMPTZ | NOT NULL | 분석 일시 | "2025-01-15 11:00:00+09" |

#### 13. `market_summary` - 시장 요약
| 컬럼명 | 타입 | 제약조건 | 설명 | 저장 예시 |
|--------|------|----------|------|-----------|
| `id` | INT | PK, AUTO_INCREMENT | 시장 데이터 ID | 1, 2, 3... |
| `symbol` | VARCHAR(20) | NOT NULL | 종목 코드 | "KOSPI", "KOSDAQ", "USD/KRW" |
| `name` | VARCHAR(100) | NOT NULL | 종목명 | "코스피", "코스닥", "달러환율" |
| `price` | DECIMAL(15,2) | NOT NULL | 현재 가격 | 2456.78, 850.45, 1325.50 |
| `change` | DECIMAL(10,2) | NOT NULL | 전일 대비 변동 | +12.34, -5.67, +8.90 |
| `change_percent` | DECIMAL(5,2) | NOT NULL | 변동률 (%) | +0.50, -0.66, +0.68 |
| `market` | VARCHAR(50) | NULLABLE | 시장 구분 | "KRX", "FOREX", "COMMODITY" |
| `currency` | VARCHAR(10) | NULLABLE | 통화 단위 | "KRW", "USD", "JPY" |
| `created_at` | TIMESTAMPTZ | NOT NULL | 생성일 | "2025-01-15 09:00:00+09" |
| `updated_at` | TIMESTAMPTZ | NOT NULL | 업데이트일 | "2025-01-15 16:30:00+09" |

---

## 📁 TypeORM 엔티티 파일 위치

### 엔티티 디렉토리: `backend/api/src/entities/`

| 파일명 | 테이블 | 주요 기능 |
|--------|--------|-----------|
| `User.ts` | users | 사용자 인증, 프로필 관리 |
| `UserPreference.ts` | user_preferences | 개인화 설정, 선호 카테고리 |
| `UserAction.ts` | user_actions | 조회/좋아요/북마크 추적 |
| `Bookmark.ts` | bookmarks | 북마크 저장/조회 |
| `NewsArticle.ts` | news_articles | 뉴스 기사 CRUD |
| `Source.ts` | sources | 언론사 정보 관리 |
| `Category.ts` | categories | 카테고리 분류 |
| `Keyword.ts` | keywords | 키워드 관리 |
| `NewsKeyword.ts` | news_keywords | M:N 관계 매핑 |
| `ArticleStat.ts` | article_stats | 통계 데이터 관리 |
| `AIRecommendation.ts` | ai_recommendations | AI 추천 결과 저장 |
| `BiasAnalysis.ts` | bias_analyses | 편향성 분석 데이터 |

### 엔티티 관계
```
User ─┬─ 1:1 ─ UserPreference
      ├─ 1:N ─ UserAction
      ├─ 1:N ─ Bookmark
      └─ 1:N ─ AIRecommendation

NewsArticle ─┬─ N:1 ─ Source
             ├─ N:1 ─ Category
             ├─ 1:1 ─ ArticleStat
             ├─ N:M ─ Keyword (via NewsKeyword)
             └─ 1:N ─ UserAction
```

---

## 🌐 API 엔드포인트 구조

### API 라우터 디렉토리: `backend/api/src/routes/`

| 파일명 | 경로 | 기능 |
|--------|------|------|
| `news.ts` | `/api/news/*` | 뉴스 조회, 검색, 트렌딩 |
| `auth.ts` | `/api/auth/*` | 로그인, 회원가입, 토큰 관리 |
| `userInteractions.ts` | `/api/users/*` | 북마크, 좋아요, 조회 기록 |
| `subscription.ts` | `/api/user/*` | 언론사 구독 관리 |
| `crawler.ts` | `/api/crawler/*` | 크롤링 상태, 수동 실행 |
| `ai.ts` | `/api/ai/*` | AI 요약, 추천, 편향성 분석 |
| `search.ts` | `/api/search` | 통합 검색 |
| `market.ts` | `/api/market/*` | 주식 시장 정보 |

### 주요 API 엔드포인트

#### 📰 뉴스 관련
```
GET  /api/feed              # 메인 피드 (최신순)
GET  /api/news/:id          # 뉴스 상세
GET  /api/trending          # 트렌딩 뉴스 (7일 기준)
GET  /api/search?q=검색어    # 뉴스 검색
GET  /api/categories        # 카테고리 목록
```

#### 👤 사용자 관련
```
POST /api/auth/register     # 회원가입
POST /api/auth/login        # 로그인
GET  /api/auth/me           # 현재 사용자 정보
POST /api/auth/social       # 소셜 로그인 (카카오/네이버)

GET  /api/users/bookmarks   # 북마크 목록
POST /api/users/bookmarks   # 북마크 추가
DELETE /api/users/bookmarks/:id # 북마크 삭제

POST /api/users/actions     # 행동 기록 (조회/좋아요)
GET  /api/users/history     # 읽기 기록

GET  /api/user/subscriptions # 구독 목록 조회
POST /api/user/subscribe     # 언론사 구독하기
DELETE /api/user/unsubscribe # 구독 취소하기
GET  /api/user/status/:sourceName # 구독 상태 확인
```

#### 🤖 AI 기능
```
POST /api/ai/summarize      # 뉴스 요약 요청
GET  /api/ai/recommendations # 개인화 추천
POST /api/ai/bias-check     # 편향성 분석
```

#### 🔄 크롤러 관리
```
GET  /api/crawler/status    # 크롤러 상태
POST /api/crawler/run       # 수동 크롤링 실행
GET  /api/crawler/stats     # 크롤링 통계
```

#### 📈 주식 정보
```
GET  /api/market/summary    # 시장 요약 (KOSPI, KOSDAQ 등)
```

---

## 🔧 서비스 레이어 구조

### 서비스 디렉토리: `backend/api/src/services/`

| 파일명 | 역할 | 주요 메서드 |
|--------|------|------------|
| `newsCrawlerService.ts` | 뉴스 크롤링 | crawlCategory(), extractKeywords(), cleanTitle() |
| `newsSchedulerService.ts` | 크롤링 스케줄러 | start(), stop(), runNow() |
| `authService.ts` | 인증 처리 | login(), register(), verifyToken() |
| `socialAuthService.ts` | 소셜 로그인 | kakaoLogin(), naverLogin() |
| `userInteractionService.ts` | 사용자 상호작용 | recordAction(), getBookmarks() |
| `subscriptionService.ts` | 구독 관리 | subscribe(), unsubscribe(), getSubscriptions() |
| `aiService.ts` | AI 연동 | summarize(), getRecommendations() |
| `marketDataService.ts` | 주식 데이터 | fetchMarketSummary() |

### 핵심 서비스 로직

#### 🔄 뉴스 크롤링 서비스
**파일**: `newsCrawlerService.ts:87-420`
- Naver News API 호출
- HTML 파싱 및 콘텐츠 추출
- 이미지 필터링 (로고/광고 제외)
- 타이틀 클리닝 (타임스탬프, 언론사명 제거)
- Jaccard 유사도 기반 중복 체크 (70% 임계값)
- 키워드 자동 추출

#### ⏰ 스케줄러 서비스
**파일**: `newsSchedulerService.ts:23-154`
- 30초마다 자동 실행
- 카테고리당 3개씩 수집
- 실행 상태 추적
- 통계 정보 제공

#### 🔐 인증 서비스
**파일**: `authService.ts:15-120`
- JWT 토큰 발급/검증
- 비밀번호 해싱 (bcrypt)
- 세션 관리

#### 📰 구독 관리 서비스
**파일**: `subscription.ts`
- 언론사 구독/구독 취소
- 사용자별 구독 목록 관리
- user_preferences.preferredSources 활용
- JSONB 배열로 다중 구독 지원

---

## 📂 설정 파일 위치

### 데이터베이스 설정
**파일**: `backend/api/src/config/database.ts`
```typescript
entities: [
  User, UserPreference, UserAction, Bookmark,
  NewsArticle, Source, Category, Keyword,
  NewsKeyword, ArticleStat, AIRecommendation,
  BiasAnalysis
]
```

### 환경 변수
**파일**: `backend/api/.env`
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=fans_user
DB_PASSWORD=fans_password
DB_NAME=fans_db

JWT_SECRET=your-jwt-secret
GEMINI_API_KEY=your-gemini-key

KAKAO_CLIENT_ID=your-kakao-id
NAVER_CLIENT_ID=your-naver-id
```

### TypeScript 설정
**파일**: `backend/api/tsconfig.json`
- Target: ES2021
- Module: CommonJS
- Strict mode 활성화

---

## 🔄 데이터 플로우

### 1. 뉴스 수집 플로우
```
[Scheduler] → 30초마다 트리거
    ↓
[Crawler Service] → Naver API 호출
    ↓
[HTML Parser] → 콘텐츠 추출
    ↓
[Title Cleaner] → 제목 정제
    ↓
[Duplicate Check] → 중복 확인
    ↓
[Database] → 저장
```

### 2. API 요청 플로우
```
[Frontend] → API 요청
    ↓
[Express Router] → 라우팅
    ↓
[Middleware] → 인증/검증
    ↓
[Controller] → 비즈니스 로직
    ↓
[Service] → DB 작업
    ↓
[TypeORM] → SQL 실행
    ↓
[Response] → JSON 응답
```

### 3. 사용자 인터랙션 플로우
```
[User Action] → 클릭/좋아요/북마크
    ↓
[API Call] → POST /api/users/actions
    ↓
[UserAction Entity] → 기록 저장
    ↓
[ArticleStat Update] → 통계 업데이트
    ↓
[AI Service] → 선호도 학습
```

---

## 🚀 빠른 시작 가이드

### 1. 데이터베이스 접속
```bash
# Docker PostgreSQL 접속
docker exec -it fans-postgres psql -U fans_user -d fans_db

# 테이블 확인
\dt

# 뉴스 조회
SELECT id, title, created_at FROM news_articles ORDER BY id DESC LIMIT 5;
```

### 2. API 테스트
```bash
# 헬스 체크
curl http://localhost:3000/health

# 최신 뉴스 조회
curl http://localhost:3000/api/feed

# 크롤러 상태
curl http://localhost:3000/api/crawler/status

# 구독 목록 조회 (로그인 필요)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/user/subscriptions

# 언론사 구독하기 (로그인 필요)
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"sourceName":"연합뉴스"}' http://localhost:3000/api/user/subscribe
```

### 3. 주요 파일 수정 위치
- **크롤링 로직**: `src/services/newsCrawlerService.ts`
- **API 엔드포인트**: `src/routes/news.ts`
- **구독 API**: `src/routes/subscription.ts`
- **DB 스키마**: `src/entities/*.ts`
- **프론트 연동**: `frontend/src/App.js`
- **활동로그 페이지**: `frontend/src/pages/ActivityLog.js`

---

## 🐛 문제 해결 가이드

### DB 연결 실패
1. Docker 컨테이너 확인: `docker ps`
2. 환경변수 확인: `.env` 파일
3. 포트 충돌 확인: `lsof -i :5432`

### 크롤링 실패
1. 스케줄러 상태: `GET /api/crawler/status`
2. 로그 확인: 콘솔 출력
3. API 키 확인: Naver API 유효성

### 프론트엔드 캐싱 문제
1. 브라우저 캐시 삭제
2. `t=Date.now()` 파라미터 확인
3. Network 탭에서 304 응답 확인

---

**📌 참고**: 이 문서는 시스템의 현재 상태를 반영하며, 코드 변경 시 업데이트가 필요합니다.