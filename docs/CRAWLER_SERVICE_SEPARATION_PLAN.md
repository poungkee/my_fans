# 크롤링 서비스 분리 및 Active-Active 클러스터 구축 계획

## 개요
현재 백엔드 API 서버에 통합되어 있는 크롤링 서비스를 독립적인 마이크로서비스로 분리하고, Active-Active 구조의 이중화된 크롤러 클러스터를 구축하여 성능과 안정성을 향상시킵니다.

## 현재 상황 분석

### 기존 구조
```
Backend API Server (Port 3000)
├── News Crawler Service (통합)
│   └── 단일 크롤러가 8개 카테고리 순차 처리
├── Auth Service
├── News Feed Service
├── Market Summary Service
└── AI Integration Service
```

### 현재 카테고리 목록 (총 8개)
1. **정치** (ID: 1)
2. **경제** (ID: 2)
3. **사회** (ID: 3)
4. **연예** (ID: 4)
5. **생활/문화** (ID: 5)
6. **IT/과학** (ID: 6)
7. **세계** (ID: 7)
8. **스포츠** (ID: 8)

### 문제점
1. **성능 병목**: 단일 크롤러가 8개 카테고리를 순차적으로 처리
2. **확장성 부족**: 크롤링 부하 증가 시 전체 시스템 영향
3. **장애 전파**: 크롤링 문제 시 메인 API 서버에 영향
4. **단일 장애점**: 크롤러 다운 시 모든 카테고리 업데이트 중단

## 목표 아키텍처: Active-Active 2x2 클러스터

### 새로운 구조
```
┌─────────────────────────────────────────────────────────────┐
│                    FANS 시스템 아키텍처                         │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Port 3001)                                       │
├─────────────────────────────────────────────────────────────┤
│  Backend API Server (Port 3000)                             │
│  ├── Auth Service                                           │
│  ├── News Feed Service                                      │
│  ├── Market Summary Service                                 │
│  └── AI Integration Service                                 │
├─────────────────────────────────────────────────────────────┤
│  Crawler Service Cluster (Active-Active 2x2)                │
│  ├── Group A (정치, 경제, 사회, 연예)                            │
│  │   ├── Crawler A1 (Port 4001) - Primary                   │
│  │   └── Crawler A2 (Port 4003) - Secondary                 │
│  └── Group B (생활/문화, IT/과학, 세계, 스포츠)                   │
│      ├── Crawler B1 (Port 4002) - Primary                   │
│      └── Crawler B2 (Port 4004) - Secondary                 │
├─────────────────────────────────────────────────────────────┤
│  AI Service (Port 8000)                                     │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL Database (Port 5432)                            │
└─────────────────────────────────────────────────────────────┘
```

## Active-Active 클러스터 설계

### 팀 A: 균형잡힌 4개 카테고리
```javascript
const TEAM_A_CATEGORIES = [
  '정치',       // ID: 1 - 높은 업데이트 빈도
  '경제',       // ID: 2 - 높은 업데이트 빈도
  '사회',       // ID: 3 - 중간 업데이트 빈도
  '생활/문화'    // ID: 5 - 중간 업데이트 빈도
];

// 예상 부하: [높음][높음][중간][중간] = 평균 부하
// Crawler A1 (Primary): 30초 간격으로 크롤링 시작
// Crawler A2 (Secondary): 15초 지연 후 크롤링 시작 (시간차 운영)
```

### 팀 B: 균형잡힌 4개 카테고리
```javascript
const TEAM_B_CATEGORIES = [
  'IT/과학',    // ID: 6 - 중간 업데이트 빈도
  '세계',       // ID: 7 - 중간 업데이트 빈도
  '스포츠',     // ID: 8 - 높은 업데이트 빈도
  '연예'        // ID: 4 - 높은 업데이트 빈도
];

// 예상 부하: [중간][중간][높음][높음] = 평균 부하
// Crawler B1 (Primary): 30초 간격으로 크롤링 시작
// Crawler B2 (Secondary): 15초 지연 후 크롤링 시작 (시간차 운영)
```

## 시간차 크롤링 전략

### 크롤링 스케줄
```
시간축: 0초   15초   30초   45초   60초   75초   90초
A1:     ●             ●             ●             ●
A2:            ●             ●             ●
B1:     ●             ●             ●             ●
B2:            ●             ●             ●
```

### 장애 처리 시나리오
1. **Primary 크롤러 장애**: Secondary가 즉시 Primary 역할 수행
2. **Secondary 크롤러 장애**: Primary가 정상 동작 계속
3. **Group 전체 장애**: 다른 Group은 영향 없이 계속 동작
4. **데이터베이스 중복 방지**: timestamp 기반 중복 검사

## 구현 계획

### 1단계: 크롤러 서비스 분리 (1-2일)
- **목표**: 기존 크롤링 로직을 독립 서비스로 추출
- **작업**:
  - `backend/crawler-service` 디렉토리 생성
  - Express.js 기반 독립 서비스 구축
  - 기존 `newsCrawlerService.ts` 로직 이전
  - 환경변수 기반 카테고리 그룹 설정

### 2단계: Active-Active 클러스터 구현 (2-3일)
- **목표**: 4개 크롤러 인스턴스 배포 및 시간차 운영
- **작업**:
  - Group A/B 카테고리 분할 로직 구현
  - Primary/Secondary 역할 설정
  - 시간차 크롤링 스케줄러 구현
  - 중복 데이터 방지 로직

### 3단계: 장애 감지 및 복구 (1-2일)
- **목표**: 자동 장애 감지 및 복구 시스템
- **작업**:
  - 헬스체크 시스템 구현
  - 장애 감지 및 알림
  - 자동 페일오버 메커니즘

## Docker Compose 설정

```yaml
version: '3.8'

services:
  # Team A Crawlers (정치, 경제, 사회, 생활/문화)
  crawler-a1:
    build: ./backend/crawler-service
    container_name: fans_crawler_a1
    ports:
      - "4001:4001"
    environment:
      - CRAWLER_TEAM=A
      - CRAWLER_ROLE=PRIMARY
      - ASSIGNED_CATEGORIES=정치,경제,사회,생활/문화
      - CRAWLER_DELAY=0
      - DB_HOST=postgres
      - PORT=4001
    depends_on:
      - postgres
    restart: unless-stopped

  crawler-a2:
    build: ./backend/crawler-service
    container_name: fans_crawler_a2
    ports:
      - "4003:4003"
    environment:
      - CRAWLER_TEAM=A
      - CRAWLER_ROLE=SECONDARY
      - ASSIGNED_CATEGORIES=정치,경제,사회,생활/문화
      - CRAWLER_DELAY=15000  # 15초 지연
      - DB_HOST=postgres
      - PORT=4003
    depends_on:
      - postgres
    restart: unless-stopped

  # Team B Crawlers (IT/과학, 세계, 스포츠, 연예)
  crawler-b1:
    build: ./backend/crawler-service
    container_name: fans_crawler_b1
    ports:
      - "4002:4002"
    environment:
      - CRAWLER_TEAM=B
      - CRAWLER_ROLE=PRIMARY
      - ASSIGNED_CATEGORIES=IT/과학,세계,스포츠,연예
      - CRAWLER_DELAY=0
      - DB_HOST=postgres
      - PORT=4002
    depends_on:
      - postgres
    restart: unless-stopped

  crawler-b2:
    build: ./backend/crawler-service
    container_name: fans_crawler_b2
    ports:
      - "4004:4004"
    environment:
      - CRAWLER_TEAM=B
      - CRAWLER_ROLE=SECONDARY
      - ASSIGNED_CATEGORIES=IT/과학,세계,스포츠,연예
      - CRAWLER_DELAY=15000  # 15초 지연
      - DB_HOST=postgres
      - PORT=4004
    depends_on:
      - postgres
    restart: unless-stopped
```

## API 설계

### 크롤러 서비스 엔드포인트
```
GET  /health                    # 크롤러 인스턴스 헬스체크
GET  /health/cluster            # 전체 클러스터 상태
POST /crawler/start             # 크롤링 시작
POST /crawler/stop              # 크롤링 중지
GET  /crawler/status            # 크롤링 상태 조회
GET  /crawler/stats             # 크롤링 통계 (그룹별)
POST /crawler/failover          # 수동 페일오버
GET  /crawler/group             # 담당 그룹 정보
```

### 백엔드 API 서버 프록시 엔드포인트
```
GET  /api/crawler/status        # 전체 클러스터 상태
GET  /api/crawler/stats         # 전체 통계
POST /api/crawler/control       # 클러스터 제어
GET  /api/crawler/health        # 클러스터 헬스체크
```

## 성능 향상 예상 효과

### 처리 속도 개선
- **기존**: 8개 카테고리 순차 처리 (예: 8분)
- **개선**: 4개씩 2그룹 병렬 + 그룹 내 2배속 (예: 2분)
- **예상 성능 향상**: 약 75% 처리 시간 단축

### 가용성 향상
- **기존**: 단일 장애점 (가용성 95%)
- **개선**: 이중화된 Active-Active (가용성 99.75%)
- **예상 가용성 향상**: 약 5% 향상

### 데이터 신선도 개선
- **기존**: 30초 간격으로 전체 카테고리 업데이트
- **개선**: 15초 간격으로 카테고리별 업데이트
- **예상 효과**: 실시간성 2배 향상

## 모니터링 및 관리

### 클러스터 모니터링
```javascript
// 클러스터 상태 모니터링
{
  "cluster_status": "healthy",
  "groups": {
    "A": {
      "primary": { "id": "A1", "status": "active", "last_crawl": "2025-09-22T15:30:00Z" },
      "secondary": { "id": "A2", "status": "active", "last_crawl": "2025-09-22T15:30:15Z" }
    },
    "B": {
      "primary": { "id": "B1", "status": "active", "last_crawl": "2025-09-22T15:30:00Z" },
      "secondary": { "id": "B2", "status": "active", "last_crawl": "2025-09-22T15:30:15Z" }
    }
  },
  "total_articles_today": 1247,
  "avg_crawl_time": "2.3s"
}
```

### 알림 및 로깅
- 크롤러 인스턴스 다운 알림
- 페일오버 발생 알림
- 데이터 수집 실패율 임계값 초과 알림
- 그룹별 성능 메트릭 로깅

## 마이그레이션 전략

### 1. 점진적 배포
1. **Week 1**: 단일 크롤러 서비스 분리 및 테스트
2. **Week 2**: Group A 이중화 구현 및 검증
3. **Week 3**: Group B 추가 및 전체 클러스터 운영
4. **Week 4**: 기존 통합 크롤러 제거

### 2. 롤백 계획
- 각 단계별 롤백 시나리오 준비
- 데이터 무결성 검증 절차
- 서비스 중단 최소화 전략

## 예상 도전과제 및 해결방안

### 1. 데이터 중복 처리
- **문제**: 동일 그룹 내 두 크롤러가 같은 기사 수집 가능성
- **해결**:
  - 시간차 크롤링으로 중복 최소화
  - 데이터베이스 레벨 unique constraint
  - 애플리케이션 레벨 중복 검사

### 2. 부하 분산 최적화
- **문제**: 카테고리별 뉴스 양 차이로 인한 불균형
- **해결**:
  - 주기적인 부하 모니터링
  - 필요시 카테고리 재분배
  - 동적 크롤링 간격 조정

### 3. 장애 감지 지연
- **문제**: 크롤러 장애 감지 시간
- **해결**:
  - 30초 간격 헬스체크
  - 3회 연속 실패 시 페일오버
  - 자동 복구 메커니즘

## 크롤러 성능 테스트 결과 (2025-09-22)

### 기본 크롤러 테스트 (3사이클)
**테스트 설정:**
- 기간: 2025-09-22 07:08:13 ~ 07:13:00 (약 5분)
- 간격: 30초마다 실행
- 카테고리당 수집: 1개 기사
- 대상 카테고리: 8개 (정치, 경제, 사회, 연예, 생활/문화, IT/과학, 세계, 스포츠)

**결과:**
- ✅ **총 수집 기사**: 32개
- ✅ **이미지 추출 성공률**: 84% (16/19 기사)
- ✅ **한글 인코딩**: 100% 성공
- ✅ **데이터베이스 저장**: 안정적 동작
- ✅ **스케줄링 정확도**: 30초 간격 정확히 유지

**성능 지표:**
- **처리 속도**: 카테고리당 평균 37.5초 (8개 카테고리 × 30초 간격 ÷ 3사이클)
- **데이터 품질**: 한글 완벽 처리, 이미지 URL 정상 추출
- **시스템 안정성**: 5분간 무중단 운영

### 품질 개선 후 테스트 (1사이클)
**개선 사항:**
- 광고 및 JavaScript 코드 필터링 강화
- 제목에서 언론사 이름 자동 제거
- 본문 품질 검증 로직 추가

**결과:**
- ⚠️ **부분적 개선**: JavaScript 코드 제거 성공
- ❌ **여전한 문제**: 광고 요소 일부 포함, 제목 정리 불완전
- 🔄 **추가 개선 필요**: 더 정교한 필터링 로직 요구

### 권장사항
1. **즉시 분리 가능**: 기본 크롤링 로직이 안정적으로 작동
2. **품질 개선 병행**: Active-Active 구축과 함께 콘텐츠 필터링 고도화
3. **모니터링 강화**: 실시간 품질 검증 시스템 구축

## 결론

Active-Active 2x2 크롤러 클러스터 구축을 통해:
- **성능**: 75% 처리 시간 단축
- **가용성**: 99.75% 가용성 달성
- **확장성**: 그룹별 독립적 확장 가능
- **안정성**: 단일 장애점 제거

**현재 상태**: 기본 크롤링 기능이 검증되어 분리 작업 진행 가능. 품질 개선은 병행하여 지속 진행.

타사 밴치마킹 내용 넣기
Ui/ux 밴치마킹???




크롤링 서비스 분리 및 Active-Active 클러스터 구축 요구명세서
1. 개요
현재 백엔드 API 서버에 통합되어 있는 크롤링 서비스를 독립적인 마이크로서비스로 분리하고, Active-Active 구조의 이중화된 크롤러 클러스터를 구축하여 성능과 안정성을 향상시킵니다.

주요 변경사항: 지정된 14개 언론사만을 대상으로 하는 선택적 크롤링으로 전환

2. 현재 상황 분석
2.1 기존 구조
Backend API Server (Port 3000)
├── News Crawler Service (통합)
│   └── 단일 크롤러가 8개 카테고리 순차 처리
├── Auth Service
├── News Feed Service
├── Market Summary Service
└── AI Integration Service
2.2 타겟 언론사 목록 (총 14개)
OID   언론사   크롤링 우선순위
001   연합뉴스   높음
020   동아일보   높음
021   문화일보   중간
022   세계일보   중간
023   조선일보   높음
025   중앙일보   높음
028   한겨레   높음
032   경향신문   중간
055   SBS   높음
056   KBS   높음
214   MBC   높음
421   뉴스1   중간
437   JTBC   높음
448   연합뉴스TV   중간
2.3 카테고리 목록 (총 8개)
정치 (ID: 1)
경제 (ID: 2)
사회 (ID: 3)
연예 (ID: 4)
생활/문화 (ID: 5)
IT/과학 (ID: 6)
세계 (ID: 7)
스포츠 (ID: 8)
2.4 문제점
성능 병목: 단일 크롤러가 8개 카테고리를 순차적으로 처리
확장성 부족: 크롤링 부하 증가 시 전체 시스템 영향
장애 전파: 크롤링 문제 시 메인 API 서버에 영향
단일 장애점: 크롤러 다운 시 모든 카테고리 업데이트 중단
데이터 품질: 불필요한 언론사 데이터 수집으로 인한 리소스 낭비
3. 목표 아키텍처: Active-Active 2x2 클러스터
3.1 새로운 구조
┌─────────────────────────────────────────────────────────────┐
│                    FANS 시스템 아키텍처                        │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Port 3001)                                      │
├─────────────────────────────────────────────────────────────┤
│  Backend API Server (Port 3000)                            │
│  ├── Auth Service                                          │
│  ├── News Feed Service                                     │
│  ├── Market Summary Service                                │
│  └── AI Integration Service                                │
├─────────────────────────────────────────────────────────────┤
│  Crawler Service Cluster (Active-Active 2x2)              │
│  ├── Group A (정치, 경제, 사회, 연예)                         │
│  │   ├── Crawler A1 (Port 4001) - Primary                 │
│  │   └── Crawler A2 (Port 4003) - Secondary               │
│  └── Group B (생활/문화, IT/과학, 세계, 스포츠)                │
│      ├── Crawler B1 (Port 4002) - Primary                 │
│      └── Crawler B2 (Port 4004) - Secondary               │
├─────────────────────────────────────────────────────────────┤
│  AI Service (Port 8000)                                    │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL Database (Port 5432)                           │
└─────────────────────────────────────────────────────────────┘
4. Active-Active 클러스터 설계
4.1 팀 A: 균형잡힌 4개 카테고리
javascript
const TEAM_A_CATEGORIES = [
  '정치',       // ID: 1 - 높은 업데이트 빈도
  '경제',       // ID: 2 - 높은 업데이트 빈도
  '사회',       // ID: 3 - 중간 업데이트 빈도
  '생활/문화'    // ID: 5 - 중간 업데이트 빈도
];
// 예상 부하: [높음][높음][중간][중간] = 평균 부하
// Crawler A1 (Primary): 30초 간격으로 크롤링 시작
// Crawler A2 (Secondary): 15초 지연 후 크롤링 시작 (시간차 운영)
4.2 팀 B: 균형잡힌 4개 카테고리
javascript
const TEAM_B_CATEGORIES = [
  'IT/과학',   // ID: 6 - 중간 업데이트 빈도
  '세계',      // ID: 7 - 중간 업데이트 빈도
  '스포츠',    // ID: 8 - 높은 업데이트 빈도
  '연예'       // ID: 4 - 높은 업데이트 빈도
];
// 예상 부하: [중간][중간][높음][높음] = 평균 부하
// Crawler B1 (Primary): 30초 간격으로 크롤링 시작
// Crawler B2 (Secondary): 15초 지연 후 크롤링 시작 (시간차 운영)
5. 언론사 필터링 로직
5.1 크롤링 전략
javascript
// 허용된 언론사 OID 목록
const ALLOWED_PRESS_OIDS = [
  '001', '020', '021', '022', '023', '025', '028', '032',
  '055', '056', '214', '421', '437', '448'
];

// 크롤링 우선순위 매핑
const PRESS_PRIORITY = {
  HIGH: ['001', '020', '023', '025', '028', '055', '056', '214', '437'],
  MEDIUM: ['021', '022', '032', '421', '448']
};
5.2 필터링 규칙
1차 필터링: OID 기반 언론사 선별
2차 필터링: 카테고리별 적합성 검증
3차 필터링: 콘텐츠 품질 검증 (제목, 본문, 이미지)
6. 데이터베이스 스키마 매핑
6.1 기존 컬럼 구조 유지
sql
-- news 테이블 구조 (변경 없음)
CREATE TABLE news (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  category_id INTEGER,
  image_url VARCHAR(500),
  original_url VARCHAR(500),
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  press_name VARCHAR(100),  -- 언론사 이름 매핑 필요
  oid VARCHAR(10)          -- 새로 추가: 언론사 OID
);
6.2 언론사 매핑 테이블
sql
-- press_mapping 테이블 (새로 생성)
CREATE TABLE press_mapping (
  oid VARCHAR(10) PRIMARY KEY,
  press_name VARCHAR(100) NOT NULL,
  priority VARCHAR(10) DEFAULT 'MEDIUM',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 초기 데이터 삽입
INSERT INTO press_mapping (oid, press_name, priority) VALUES
('001', '연합뉴스', 'HIGH'),
('020', '동아일보', 'HIGH'),
('021', '문화일보', 'MEDIUM'),
('022', '세계일보', 'MEDIUM'),
('023', '조선일보', 'HIGH'),
('025', '중앙일보', 'HIGH'),
('028', '한겨레', 'HIGH'),
('032', '경향신문', 'MEDIUM'),
('055', 'SBS', 'HIGH'),
('056', 'KBS', 'HIGH'),
('214', 'MBC', 'HIGH'),
('421', '뉴스1', 'MEDIUM'),
('437', 'JTBC', 'HIGH'),
('448', '연합뉴스TV', 'MEDIUM');
7. 시간차 크롤링 전략
7.1 크롤링 스케줄
시간축: 0초   15초   30초   45초   60초   75초   90초
A1:     ●             ●             ●             ●
A2:            ●             ●             ●
B1:     ●             ●             ●             ●
B2:            ●             ●             ●
7.2 장애 처리 시나리오
Primary 크롤러 장애: Secondary가 즉시 Primary 역할 수행
Secondary 크롤러 장애: Primary가 정상 동작 계속
Group 전체 장애: 다른 Group은 영향 없이 계속 동작
데이터베이스 중복 방지: timestamp + url 기반 중복 검사
8. 구현 단계별 계획
8.1 1단계: 크롤러 서비스 분리 (1-2일)
목표: 기존 크롤링 로직을 독립 서비스로 추출

작업 내용:

 backend/crawler-service 디렉토리 생성
 Express.js 기반 독립 서비스 구축
 언론사 필터링 로직 구현
 기존 newsCrawlerService.ts 제거
 환경변수 기반 카테고리 그룹 설정
 press_mapping 테이블 생성 및 데이터 삽입
8.2 2단계: Active-Active 클러스터 구현 (2-3일)
목표: 4개 크롤러 인스턴스 배포 및 시간차 운영

작업 내용:

 Group A/B 카테고리 분할 로직 구현
 Primary/Secondary 역할 설정
 시간차 크롤링 스케줄러 구현
 중복 데이터 방지 로직
 언론사 우선순위 기반 크롤링 순서 최적화
8.3 3단계: 장애 감지 및 복구 (1-2일)
목표: 자동 장애 감지 및 복구 시스템

작업 내용:

 헬스체크 시스템 구현
 장애 감지 및 알림
 자동 페일오버 메커니즘
 언론사별 크롤링 성공률 모니터링
9. Docker Compose 설정
9.1 환경변수 설정
yaml
version: '3.8'
services:
  # Team A Crawlers (정치, 경제, 사회, 생활/문화)
  crawler-a1:
    build: ./backend/crawler-service
    container_name: fans_crawler_a1
    ports:
      - "4001:4001"
    environment:
      - CRAWLER_TEAM=A
      - CRAWLER_ROLE=PRIMARY
      - ASSIGNED_CATEGORIES=1,2,3,5  # 정치,경제,사회,생활/문화
      - CRAWLER_DELAY=0
      - ALLOWED_PRESS_OIDS=001,020,021,022,023,025,028,032,055,056,214,421,437,448
      - DB_HOST=postgres
      - PORT=4001
    depends_on:
      - postgres
    restart: unless-stopped

  crawler-a2:
    build: ./backend/crawler-service
    container_name: fans_crawler_a2
    ports:
      - "4003:4003"
    environment:
      - CRAWLER_TEAM=A
      - CRAWLER_ROLE=SECONDARY
      - ASSIGNED_CATEGORIES=1,2,3,5
      - CRAWLER_DELAY=15000  # 15초 지연
      - ALLOWED_PRESS_OIDS=001,020,021,022,023,025,028,032,055,056,214,421,437,448
      - DB_HOST=postgres
      - PORT=4003
    depends_on:
      - postgres
    restart: unless-stopped

  # Team B Crawlers (IT/과학, 세계, 스포츠, 연예)
  crawler-b1:
    build: ./backend/crawler-service
    container_name: fans_crawler_b1
    ports:
      - "4002:4002"
    environment:
      - CRAWLER_TEAM=B
      - CRAWLER_ROLE=PRIMARY
      - ASSIGNED_CATEGORIES=6,7,8,4  # IT/과학,세계,스포츠,연예
      - CRAWLER_DELAY=0
      - ALLOWED_PRESS_OIDS=001,020,021,022,023,025,028,032,055,056,214,421,437,448
      - DB_HOST=postgres
      - PORT=4002
    depends_on:
      - postgres
    restart: unless-stopped

  crawler-b2:
    build: ./backend/crawler-service
    container_name: fans_crawler_b2
    ports:
      - "4004:4004"
    environment:
      - CRAWLER_TEAM=B
      - CRAWLER_ROLE=SECONDARY
      - ASSIGNED_CATEGORIES=6,7,8,4
      - CRAWLER_DELAY=15000  # 15초 지연
      - ALLOWED_PRESS_OIDS=001,020,021,022,023,025,028,032,055,056,214,421,437,448
      - DB_HOST=postgres
      - PORT=4004
    depends_on:
      - postgres
    restart: unless-stopped
10. API 설계
10.1 크롤러 서비스 엔드포인트
GET  /health                    # 크롤러 인스턴스 헬스체크
GET  /health/cluster            # 전체 클러스터 상태
POST /crawler/start             # 크롤링 시작
POST /crawler/stop              # 크롤링 중지
GET  /crawler/status            # 크롤링 상태 조회
GET  /crawler/stats             # 크롤링 통계 (그룹별, 언론사별)
POST /crawler/failover          # 수동 페일오버
GET  /crawler/group             # 담당 그룹 정보
GET  /crawler/press             # 허용된 언론사 목록
POST /crawler/press/priority    # 언론사 우선순위 변경
10.2 백엔드 API 서버 프록시 엔드포인트
GET  /api/crawler/status        # 전체 클러스터 상태
GET  /api/crawler/stats         # 전체 통계 (언론사별 포함)
POST /api/crawler/control       # 클러스터 제어
GET  /api/crawler/health        # 클러스터 헬스체크
GET  /api/crawler/press/stats   # 언론사별 수집 통계
11. 성능 향상 예상 효과
11.1 처리 속도 개선
기존: 8개 카테고리 × 전체 언론사 순차 처리 (예: 12분)
개선: 4개씩 2그룹 병렬 + 14개 언론사만 대상 (예: 3분)
예상 성능 향상: 약 75% 처리 시간 단축
11.2 데이터 품질 향상
기존: 무작위 언론사 데이터 수집
개선: 신뢰도 높은 14개 언론사만 선별 수집
예상 효과: 데이터 품질 40% 향상, 저장공간 60% 절약
11.3 가용성 향상
기존: 단일 장애점 (가용성 95%)
개선: 이중화된 Active-Active (가용성 99.75%)
예상 가용성 향상: 약 5% 향상
11.4 실시간성 개선
기존: 30초 간격으로 전체 카테고리 업데이트
개선: 15초 간격으로 카테고리별 업데이트
예상 효과: 실시간성 2배 향상
12. 모니터링 및 관리
12.1 클러스터 상태 모니터링
javascript
// 클러스터 상태 모니터링 응답 예시
{
  "cluster_status": "healthy",
  "groups": {
    "A": {
      "primary": { "id": "A1", "status": "active", "last_crawl": "2025-09-22T15:30:00Z" },
      "secondary": { "id": "A2", "status": "active", "last_crawl": "2025-09-22T15:30:15Z" }
    },
    "B": {
      "primary": { "id": "B1", "status": "active", "last_crawl": "2025-09-22T15:30:00Z" },
      "secondary": { "id": "B2", "status": "active", "last_crawl": "2025-09-22T15:30:15Z" }
    }
  },
  "press_stats": {
    "001": { "name": "연합뉴스", "articles_today": 47, "success_rate": "98%" },
    "020": { "name": "동아일보", "articles_today": 32, "success_rate": "95%" },
    // ... 기타 언론사 통계
  },
  "total_articles_today": 1247,
  "avg_crawl_time": "1.8s"
}
12.2 언론사별 성능 메트릭
javascript
// 언론사별 상세 통계
{
  "press_performance": {
    "high_priority": {
      "total_articles": 892,
      "avg_crawl_time": "1.2s",
      "success_rate": "97.5%"
    },
    "medium_priority": {
      "total_articles": 355,
      "avg_crawl_time": "1.8s", 
      "success_rate": "94.2%"
    }
  }
}
12.3 알림 및 로깅
크롤러 인스턴스 다운 알림
페일오버 발생 알림
언론사별 크롤링 실패율 임계값 초과 알림 (5% 이상)
그룹별 성능 메트릭 로깅
허용되지 않은 언론사 접근 시도 로깅
13. 마이그레이션 전략
13.1 점진적 배포 일정
Week 1: 단일 크롤러 서비스 분리 및 언론사 필터링 구현
Week 2: Group A 이중화 구현 및 검증
Week 3: Group B 추가 및 전체 클러스터 운영
Week 4: 기존 통합 크롤러 완전 제거
13.2 롤백 계획
각 단계별 롤백 시나리오 준비
데이터 무결성 검증 절차
서비스 중단 최소화 전략 (블루-그린 배포)
13.3 데이터 마이그레이션
기존 뉴스 데이터에 OID 컬럼 추가
언론사명 기반 OID 매핑 스크립트 실행
허용되지 않은 언론사 데이터 아카이빙
14. 예상 도전과제 및 해결방안
14.1 언론사 필터링 누락
문제: 새로운 언론사 또는 OID 변경
해결:
정기적인 언론사 목록 업데이트
알 수 없는 OID 발견 시 알림 시스템
수동 승인 프로세스
14.2 데이터 중복 처리
문제: 동일 그룹 내 두 크롤러가 같은 기사 수집
해결:
시간차 크롤링으로 중복 최소화
(original_url, published_at) unique constraint
애플리케이션 레벨 중복 검사
14.3 언론사별 부하 불균형
문제: 특정 언론사의 높은 기사 생산량
해결:
언론사별 크롤링 간격 동적 조정
우선순위 기반 처리 순서 최적화
부하 분산 알고리즘 적용
14.4 장애 감지 지연
문제: 크롤러 장애 감지 시간
해결:
30초 간격 헬스체크
3회 연속 실패 시 페일오버
자동 복구 메커니즘
15. 테스트 계획
15.1 단위 테스트
 언론사 필터링 로직 테스트
 카테고리 분배 로직 테스트
 중복 검사 로직 테스트
 시간차 스케줄링 테스트
15.2 통합 테스트
 클러스터 간 통신 테스트
 페일오버 시나리오 테스트
 부하 분산 테스트
 데이터 정합성 테스트
15.3 성능 테스트
 14개 언론사 대상 크롤링 성능 측정
 동시 크롤러 실행 시 리소스 사용량 측정
 장시간 운영 안정성 테스트
16. 결론
이번 크롤링 서비스 분리 및 Active-Active 클러스터 구축을 통해 다음과 같은 효과를 기대할 수 있습니다:

16.1 정량적 효과
성능: 75% 처리 시간 단축
가용성: 99.75% 가용성 달성
데이터 품질: 신뢰도 높은 14개 언론사만 수집
리소스 효율성: 저장공간 60% 절약
16.2 정성적 효과
확장성: 그룹별 독립적 확장 가능
안정성: 단일 장애점 제거
관리성: 언론사별 세분화된 모니터링
유지보수성: 마이크로서비스 아키텍처 적용
16.3 구현 준비도
현재 상태에서 기본 크롤링 기능이 검증되어 있어 분리 작업을 즉시 진행할 수 있으며, 언론사 필터링을 통한 데이터 품질 개선을 병행하여 추진할 예정입니다.

작성일: 2025-09-23
문서 버전: v2.0
최종 수정: 언론사 선별 크롤링 요구사항 반영

---

# 개발 진행 로그

## 2025-09-24 개발 진행상황

### 주요 변경사항: API/RSS 이중 크롤링 시스템 구현

기존 카테고리 기반 2x2 구조에서 **API/RSS 기반 2x2 구조**로 설계 변경

#### 새로운 아키텍처: API/RSS Active-Active 2x2 클러스터

```
┌─────────────────────────────────────────────────────────────┐
│                    FANS 시스템 아키텍처 v3.0                    │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Port 3001)                                      │
├─────────────────────────────────────────────────────────────┤
│  Backend API Server (Port 3000)                            │
│  ├── Auth Service                                          │
│  ├── News Feed Service                                     │
│  ├── Market Summary Service                                │
│  └── AI Integration Service                                │
├─────────────────────────────────────────────────────────────┤
│  Crawler Service Cluster (API/RSS Active-Active 2x2)      │
│  ├── Group A (API 크롤링)                                   │
│  │   ├── API Crawler A1 (Port 4001) - Primary             │
│  │   └── API Crawler A2 (Port 4003) - Secondary           │
│  └── Group B (RSS 크롤링)                                   │
│      ├── RSS Crawler B1 (Port 4002) - Primary             │
│      └── RSS Crawler B2 (Port 4004) - Secondary           │
├─────────────────────────────────────────────────────────────┤
│  AI Service (Port 8000)                                    │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL Database (Port 5432)                           │
└─────────────────────────────────────────────────────────────┘
```

#### 변경 이유 및 배경

**문제점 발견:**
- Naver API 크롤링 효율성 저하 (16.7% 성공률)
- 타겟 언론사 필터링으로 인한 대부분 뉴스 차단
- 지역/소규모 언론사 위주의 API 결과

**해결방안:**
- RSS 피드를 통한 직접 수집으로 품질 및 효율성 확보
- API와 RSS 이중화로 안정성 극대화
- 각 방식의 장점 활용한 상호 보완적 구조

#### 구현된 내용

**1. RSS 크롤링 서비스 구현**
- 파일: `/src/services/rssCrawlerService.ts`
- 5개 주요 언론사 RSS 피드 연동
  - 경향신문, 동아일보, 한겨레, 조선일보, 국민일보
- xml2js 라이브러리 활용한 RSS 파싱
- 기존 API 크롤러와 동일한 데이터베이스 저장 로직

**2. 이중 크롤링 엔드포인트 구현**
- `POST /crawl/api/start`: API 전용 크롤링
- `POST /crawl/rss/start`: RSS 전용 크롤링
- `POST /crawl/all/start`: 통합 크롤링 (API + RSS)

**3. RSS 피드 호환성 테스트 완료**
- ✅ 경향신문: 완전한 XML 구조, 제목/링크/설명/날짜 포함
- ✅ 동아일보: 완전한 XML, 이미지까지 포함된 풍부한 데이터
- ✅ 한겨레신문: 정상 RSS 응답
- ✅ 조선일보: 완전한 RSS 구조, 다양한 메타데이터
- ✅ 국민일보: 정상 응답

#### 예상 성능 개선 효과

**수집량 증가:**
- 기존: Naver API 8개 카테고리 × 1개 = 8개 (실제 4개만 저장)
- 개선: RSS 5개 언론사 × 10개 + API 8개 = 58개 예상

**품질 향상:**
- RSS: 직접 언론사 피드로 정확한 출처/기자명 확보
- API: 다양성 확보를 위한 보조 역할

**안정성 향상:**
- API 장애시 RSS로 백업
- RSS 장애시 API로 백업
- 상호 독립적 운영 가능

#### Docker Compose 업데이트 (예정)

```yaml
# Group A: API Crawlers
api-crawler-a1:
  environment:
    - CRAWLER_TYPE=API
    - CRAWLER_ROLE=PRIMARY
    - NAVER_CLIENT_ID=${NAVER_CLIENT_ID}
    - NAVER_CLIENT_SECRET=${NAVER_CLIENT_SECRET}

api-crawler-a2:
  environment:
    - CRAWLER_TYPE=API
    - CRAWLER_ROLE=SECONDARY
    - CRAWLER_DELAY=15000

# Group B: RSS Crawlers
rss-crawler-b1:
  environment:
    - CRAWLER_TYPE=RSS
    - CRAWLER_ROLE=PRIMARY
    - RSS_FEEDS=khan,donga,hani,chosun,kmib

rss-crawler-b2:
  environment:
    - CRAWLER_TYPE=RSS
    - CRAWLER_ROLE=SECONDARY
    - CRAWLER_DELAY=15000
```

#### 개발 진행 상태

**✅ 완료:**
- 크롤링 서비스 독립적 분리
- RSS 크롤러 서비스 구현
- API/RSS 통합 엔드포인트 구현
- RSS 피드 호환성 검증
- 기자 이름 추출 로직 개선

**🔄 진행중:**
- 작업 과정 문서화

**📋 예정:**
- RSS 크롤러 실제 테스트 및 검증
- 저장 개수 기준 크롤링 로직 수정
- Docker 컨테이너화
- 다중 인스턴스 확장

#### 기술적 변경사항

**새로 추가된 종속성:**
- `xml2js`: RSS XML 파싱
- `@types/xml2js`: TypeScript 타입 정의

**코드 구조 개선:**
- API 크롤러와 RSS 크롤러 완전 분리
- 공통 데이터베이스 저장 로직 재사용
- 중복 검사 로직 통합

**성능 최적화:**
- RSS 피드간 1초 딜레이로 서버 부하 분산
- 타임아웃 10초 설정으로 응답성 확보
- 중복 URL 기반 중복 제거

---

**개발 로그 업데이트:** 2025-09-24
**다음 마일스톤:** RSS 크롤러 실제 운영 테스트

