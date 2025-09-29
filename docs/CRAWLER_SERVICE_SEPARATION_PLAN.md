# 크롤링 서비스 분리 및 Active-Active 클러스터 구축 계획

## 1. 개요

현재 백엔드 API 서버에 통합되어 있는 크롤링 서비스를 독립적인 마이크로서비스로 분리하고, Active-Active 구조의 이중화된 크롤러 클러스터를 구축하여 성능과 안정성을 향상시킵니다.

---

## 2. 현재 상황 분석

### 2.1 기존 구조
```
Backend API Server (Port 3000)
├── News Crawler Service (통합)
│   ├── Naver API 크롤러 (검색 쿼리 기반)
│   └── RSS 크롤러 (5개 언론사 직접 수집)
├── Auth Service
├── News Feed Service
├── Market Summary Service
└── AI Integration Service
```

### 2.2 현재 크롤링 방식

**Naver API 크롤러**:
- 검색 쿼리를 통한 뉴스 수집
- 다양한 언론사의 최신 뉴스 획득 시도
- 필터링 후 실제 저장률: **16.7%**

**RSS 피드 크롤러**:
- 주요 5개 언론사 직접 수집
  - 조선일보 (SPA 처리)
  - 매일경제 (SPA 처리)
  - 머니투데이
  - 한겨레
  - 한국경제
- 각 언론사별 최신 10개 기사 수집

### 2.3 핵심 문제점

1. **데이터 품질 문제**
   - Naver API: 원하는 언론사 필터링 불가
   - 지역/소규모 언론사 위주 결과
   - 실제 사용 가능한 기사 부족

2. **시스템 구조 문제**
   - API/RSS 크롤러가 단일 스레드로 순차 처리
   - 크롤링 문제 시 메인 API 서버에 영향
   - 단일 장애점으로 전체 서비스 중단 위험

---

## 3. 목표 아키텍처: API/RSS Active-Active 2x2 클러스터

### 3.1 새로운 시스템 구조
```
┌─────────────────────────────────────────────────────────────┐
│                    FANS 시스템 아키텍처                      │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Port 3001)                                       │
├─────────────────────────────────────────────────────────────┤
│  Backend API Server (Port 3000)                             │
│  ├── Auth Service                                           │
│  ├── News Feed Service                                      │
│  ├── Market Summary Service                                 │
│  └── AI Integration Service                                 │
├─────────────────────────────────────────────────────────────┤
│  Crawler Service Cluster (API/RSS Active-Active 2x2)        │
│  ├── Group A (Naver API 크롤러)                             │
│  │   ├── API Crawler A1 (Port 4001) - Primary              │
│  │   └── API Crawler A2 (Port 4003) - Secondary            │
│  └── Group B (RSS 피드 크롤러)                              │
│      ├── RSS Crawler B1 (Port 4002) - Primary              │
│      └── RSS Crawler B2 (Port 4004) - Secondary            │
├─────────────────────────────────────────────────────────────┤
│  AI Service (Port 8002)                                     │
│  └── Bias Analysis (편향성 분석)                            │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL Database (Port 5432)                            │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 크롤러 그룹별 설정

#### Group A: Naver API 크롤러
```javascript
const API_CRAWLER_CONFIG = {
  type: 'NAVER_API',
  searchQuery: '최신 뉴스',
  interval: 30000,      // 30초
  maxResults: 100,      // API 최대 결과
  filterEnabled: true   // 품질 필터링
};
```

#### Group B: RSS 피드 크롤러
```javascript
const RSS_CRAWLER_CONFIG = {
  type: 'RSS_FEED',
  sources: [
    { name: '조선일보', url: 'https://www.chosun.com/arc/outboundfeeds/rss/', type: 'SPA' },
    { name: '매일경제', url: 'https://www.mk.co.kr/rss/30000001/', type: 'SPA' },
    { name: '머니투데이', url: 'https://rss.mt.co.kr/mt_news.xml', type: 'NORMAL' },
    { name: '한겨레', url: 'https://www.hani.co.kr/rss/', type: 'NORMAL' },
    { name: '한국경제', url: 'https://www.hankyung.com/feed/all-news', type: 'NORMAL' }
  ],
  interval: 30000,           // 30초
  articlesPerSource: 10      // 언론사당 10개
};
```

### 3.3 시간차 크롤링 전략
```
시간축: 0초   15초   30초   45초   60초   75초   90초
A1:     ●            ●            ●            ●
A2:           ●            ●            ●
B1:     ●            ●            ●            ●
B2:           ●            ●            ●
```

---

## 4. 구현 계획

### 4.1 Phase 1: 크롤러 서비스 분리 (1-2일)
- [x] `backend/crawler-service` 디렉토리 생성
- [x] API/RSS 크롤러 분리 구현
- [x] 환경변수 기반 설정
- [ ] Docker 컨테이너화

### 4.2 Phase 2: Active-Active 클러스터 (2-3일)
- [ ] 4개 크롤러 인스턴스 구성
- [ ] Primary/Secondary 역할 설정
- [ ] 시간차 스케줄링 구현
- [ ] 중복 방지 로직

### 4.3 Phase 3: 모니터링 시스템 (1-2일)
- [ ] 헬스체크 엔드포인트
- [ ] 크롤링 통계 대시보드
- [ ] 장애 알림 시스템

---

## 5. Docker Compose 설정

```yaml
version: '3.8'

services:
  # Group A: Naver API Crawlers
  api-crawler-a1:
    build: ./backend/crawler-service
    container_name: fans_api_crawler_a1
    ports:
      - "4001:4001"
    environment:
      - CRAWLER_TYPE=API
      - CRAWLER_ROLE=PRIMARY
      - NAVER_CLIENT_ID=${NAVER_CLIENT_ID}
      - NAVER_CLIENT_SECRET=${NAVER_CLIENT_SECRET}
      - SEARCH_QUERY=최신 뉴스
      - CRAWLER_DELAY=0
      - DB_HOST=postgres
      - PORT=4001
    depends_on:
      - postgres
    restart: unless-stopped

  api-crawler-a2:
    build: ./backend/crawler-service
    container_name: fans_api_crawler_a2
    ports:
      - "4003:4003"
    environment:
      - CRAWLER_TYPE=API
      - CRAWLER_ROLE=SECONDARY
      - NAVER_CLIENT_ID=${NAVER_CLIENT_ID}
      - NAVER_CLIENT_SECRET=${NAVER_CLIENT_SECRET}
      - SEARCH_QUERY=최신 뉴스
      - CRAWLER_DELAY=15000
      - DB_HOST=postgres
      - PORT=4003
    depends_on:
      - postgres
    restart: unless-stopped

  # Group B: RSS Feed Crawlers
  rss-crawler-b1:
    build: ./backend/crawler-service
    container_name: fans_rss_crawler_b1
    ports:
      - "4002:4002"
    environment:
      - CRAWLER_TYPE=RSS
      - CRAWLER_ROLE=PRIMARY
      - RSS_FEEDS=chosun,mk,mt,hani,hankyung
      - CRAWLER_DELAY=0
      - DB_HOST=postgres
      - PORT=4002
    depends_on:
      - postgres
    restart: unless-stopped

  rss-crawler-b2:
    build: ./backend/crawler-service
    container_name: fans_rss_crawler_b2
    ports:
      - "4004:4004"
    environment:
      - CRAWLER_TYPE=RSS
      - CRAWLER_ROLE=SECONDARY
      - RSS_FEEDS=chosun,mk,mt,hani,hankyung
      - CRAWLER_DELAY=15000
      - DB_HOST=postgres
      - PORT=4004
    depends_on:
      - postgres
    restart: unless-stopped
```

---

## 6. API 엔드포인트

### 6.1 크롤러 서비스 엔드포인트
```
GET  /health                    # 헬스체크
GET  /crawler/status            # 크롤링 상태
GET  /crawler/stats             # 크롤링 통계
POST /crawler/start             # 크롤링 시작
POST /crawler/stop              # 크롤링 중지
```

### 6.2 메인 API 프록시 엔드포인트
```
GET  /api/crawler/cluster/status   # 전체 클러스터 상태
GET  /api/crawler/cluster/stats    # 통합 통계
POST /api/crawler/cluster/control  # 클러스터 제어
```

---

## 7. 모니터링 및 관리

### 7.1 클러스터 상태 모니터링
```json
{
  "cluster_status": "healthy",
  "groups": {
    "A": {
      "type": "NAVER_API",
      "primary": { "id": "A1", "status": "active", "last_crawl": "2025-09-29T15:30:00Z" },
      "secondary": { "id": "A2", "status": "active", "last_crawl": "2025-09-29T15:30:15Z" }
    },
    "B": {
      "type": "RSS_FEED",
      "primary": { "id": "B1", "status": "active", "last_crawl": "2025-09-29T15:30:00Z" },
      "secondary": { "id": "B2", "status": "active", "last_crawl": "2025-09-29T15:30:15Z" }
    }
  },
  "statistics": {
    "total_articles_today": 847,
    "api_success_rate": "16.7%",
    "rss_success_rate": "92.3%",
    "avg_crawl_time": "1.8s"
  }
}
```

### 7.2 알림 시스템
- 크롤러 인스턴스 다운 알림
- API 성공률 15% 미만 시 알림
- RSS 피드 오류 발생 알림
- 데이터베이스 연결 실패 알림

---

## 8. 성능 개선 효과

### 8.1 예상 효과
| 항목 | 기존 | 개선 후 | 향상률 |
|------|------|---------|--------|
| 처리 속도 | 8분 | 2분 | 75% ↑ |
| 가용성 | 95% | 99.75% | 5% ↑ |
| 데이터 수집량 | 8개/분 | 50개/분 | 525% ↑ |
| 실시간성 | 30초 | 15초 | 2배 ↑ |

### 8.2 장애 대응
- **Primary 장애**: Secondary 자동 승격
- **Group 장애**: 다른 Group 독립 운영
- **완전 복구**: 15초 이내

---

## 9. 개발 진행 현황 (2025-09-29)

### 9.1 완료된 작업 ✅
- RSS 크롤러 구현 및 안정화
- SPA 사이트 처리 (조선일보, 매일경제)
- 인코딩 깨짐 감지 및 필터링
- AI 편향성 분석 서비스 통합
- 문단 구분 개선

### 9.2 진행중 🔄
- 크롤러 서비스 독립 분리
- Docker 컨테이너화

### 9.3 예정 📋
- Active-Active 클러스터 구축
- 모니터링 대시보드
- 자동 페일오버

---

## 10. 주요 의사결정 기록

### 10.1 카테고리 기반 → API/RSS 기반 전환 (2025-09-24)

**문제점**:
- Naver API로 특정 언론사 필터링 불가
- 카테고리별 크롤링 시 데이터 절대량 부족
- 필터링 후 16.7%만 저장 가능

**해결책**:
- Naver API: 다양성 확보용 보조 수단
- RSS 피드: 주요 언론사 직접 수집으로 품질 확보
- 이중화 구조로 안정성 확보

### 10.2 SPA 처리 방식 결정 (2025-09-27)

**문제점**:
- 조선일보, 매일경제 등 SPA 구조로 콘텐츠 추출 불가

**해결책**:
- RSS description 필드 활용
- Puppeteer 도입은 비용 문제로 보류 (월 $30-60 추가)

---

**문서 버전**: v3.0
**최종 수정**: 2025-09-29
**다음 검토**: 2025-10-06