# Puppeteer Crawler

Puppeteer 기반 뉴스 크롤러 서비스 (JavaScript 렌더링 사이트 지원)

---

## 🔄 크롤링 분산 방식 전환

### 방법 1: 환경변수 기반 (현재 활성화) ✅
- **장점**: 완벽한 시간차 분산, 정확한 부하 제어
- **단점**: 인스턴스 추가 시 docker-compose.yml 수동 편집 필요

### 방법 2: 랜덤 지연
- **장점**: `docker-compose up -d --scale` 명령으로 자동 확장 가능
- **단점**: 대략적인 분산 (완벽한 균등 분배 아님)

### 전환 방법

**1️⃣ index.ts 수정:**
```typescript
// src/index.ts 94~99번째 줄

// 방법 1 → 방법 2 전환
function startAutoCrawling(service: NewsCrawlerService): void {
  // startAutoCrawlingWithEnv(service);        // ← 주석 처리
  startAutoCrawlingWithRandom(service);        // ← 주석 해제
}
```

**2️⃣ docker-compose.yml 수정:**
```yaml
# 방법 1 사용 중: puppeteer-crawler-1, 2, 3 활성화
puppeteer-crawler-1:
  ...

# 방법 2로 전환: 위 3개 주석 처리하고 아래 주석 해제
# puppeteer-crawler-random:
#   ...
```

**3️⃣ 재빌드:**
```bash
docker-compose build puppeteer-crawler
docker-compose up -d
```

---

## 특징

- ✅ **브라우저 풀링**: 최대 5개 브라우저 인스턴스 병렬 실행
- ✅ **컨테이너 스케일링**: `--scale` 명령으로 쉽게 확장
- ✅ **시간차 분산**: 여러 인스턴스가 자동으로 시간차를 두고 크롤링
- ✅ **타겟 언론사**: JTBC, 문화일보, 중앙일보, 한국일보
- ✅ **URL 중복 방지**: 자동 중복 체크
- ✅ **범용성**: 모든 CSR 사이트 크롤링 가능

## 사용법

### 기본 실행 (3개 인스턴스)

```bash
docker-compose up -d --scale puppeteer-crawler=3
```

**실행 시간:**
- 인스턴스 0: 0초 시작 → 3분마다 반복
- 인스턴스 1: 60초 시작 → 3분마다 반복
- 인스턴스 2: 120초 시작 → 3분마다 반복

### 인스턴스 수 변경

```bash
# 5개로 확장
docker-compose up -d --scale puppeteer-crawler=5

# 1개로 축소
docker-compose up -d --scale puppeteer-crawler=1
```

### 크롤링 간격 변경

**.env 파일 수정:**
```bash
CRAWL_INTERVAL=300000  # 5분 (밀리초)
```

**또는 명령어로:**
```bash
CRAWL_INTERVAL=600000 docker-compose up -d --scale puppeteer-crawler=3
```

### 수동 크롤링

```bash
# 특정 언론사 크롤링
curl -X POST http://localhost:4004/crawl/JTBC
curl -X POST http://localhost:4004/crawl/문화일보

# 전체 크롤링
curl -X POST http://localhost:4004/crawl-all
```

## API 엔드포인트

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | 서비스 상태 확인 |
| POST | `/crawl/:sourceName` | 특정 언론사 크롤링 |
| POST | `/crawl-all` | 전체 언론사 크롤링 |
| GET | `/pool-stats` | 브라우저 풀 상태 조회 |

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PUPPETEER_CRAWLER_PORT` | 4004 | 서버 포트 |
| `AUTO_CRAWL` | true | 자동 크롤링 활성화 |
| `CRAWL_INTERVAL` | 180000 | 크롤링 간격 (ms) |
| `TOTAL_REPLICAS` | 3 | 총 인스턴스 수 (힌트) |

## 타겟 언론사

- JTBC
- 문화일보
- 중앙일보
- 한국일보

## 성능

**단일 인스턴스:**
- 브라우저 풀: 최대 5개
- 병렬 크롤링: URL 5개씩
- 예상 시간: 100개 URL → 약 2~3분

**3개 인스턴스 (권장):**
- 총 처리량: 3배
- 부하 분산: 시간차 실행으로 서버 부하 최소화

## 로그 확인

```bash
# 특정 인스턴스
docker logs fans-puppeteer-crawler-1

# 실시간
docker logs -f fans-puppeteer-crawler-1

# 전체 인스턴스
docker-compose logs puppeteer-crawler
```

## 확장 방법

### 새 언론사 추가

1. `src/services/siteParsers/` 에 파서 추가
2. `src/services/newsCrawlerService.ts` 에 등록
3. 재빌드: `docker-compose build puppeteer-crawler`

### 크롤링 로직 수정

모든 설정은 환경변수로 제어 가능하므로 **코드 수정 불필요**

## 문제 해결

### 메모리 부족
```yaml
shm_size: '4gb'  # docker-compose.yml에서 증가
```

### 크롤링 실패
```bash
# 로그 확인
docker logs fans-puppeteer-crawler-1 | grep ERROR

# 브라우저 풀 상태
curl http://localhost:4004/pool-stats
```
