# AI Worker - BullMQ Consumer

## 개요

BullMQ를 사용하여 Redis 큐에서 AI 작업을 처리하는 Worker 서비스입니다.

## 기능

4개의 큐를 처리:
1. **ai-summary**: AI 요약 생성
2. **ai-bias**: 편향성 분석
3. **ai-keyword**: 키워드 추출
4. **ai-recommendation**: 맞춤 추천

## 로컬 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env` 파일 생성:

```bash
cp .env.example .env
```

### 3. 개발 모드 실행

```bash
npm run dev
```

### 4. 프로덕션 빌드

```bash
npm run build
npm start
```

## Docker 실행

### 단독 실행

```bash
docker build -t fans-ai-worker .
docker run -d \
  --name fans-ai-worker \
  -e REDIS_HOST=redis \
  -e REDIS_PORT=6379 \
  fans-ai-worker
```

### Docker Compose로 실행

```bash
cd environments/local
docker-compose -f docker-compose.yml -f docker-compose.ai-worker.yml up -d ai-worker
```

## 확인

### Worker 로그

```bash
docker logs -f fans_ai_worker
```

### Redis 큐 확인

```bash
docker exec -it fans_redis redis-cli

# 큐 길이 확인
LLEN bull:ai-summary:wait
LLEN bull:ai-bias:wait
LLEN bull:ai-keyword:wait
LLEN bull:ai-recommendation:wait

# 진행 중인 작업
LLEN bull:ai-summary:active
```

## 설정

### 동시 처리 작업 수

`.env` 파일에서 `WORKER_CONCURRENCY` 조정:

```bash
WORKER_CONCURRENCY=10  # 기본값: 5
```

### Rate Limiting

각 Worker는 초당 처리량 제한이 있습니다:
- Summary/Bias/Keyword: **10개/초**
- Recommendation: **5개/초** (더 무거움)

`src/index.ts`에서 수정 가능:

```typescript
limiter: {
  max: 10,
  duration: 1000, // 1초당 10개
}
```

## 재시도 정책

Job 실패 시 자동 재시도:
- 재시도 횟수: **3회**
- 재시도 간격: **Exponential Backoff**
  - 1차: 5초
  - 2차: 10초
  - 3차: 20초

설정 위치: `backend/queue/src/config/queue-names.ts`

## 에러 처리

### 재시도 가능한 에러
- `ECONNREFUSED`: AI 서비스 연결 실패
- `ETIMEDOUT`: 타임아웃

### 재시도 불가능한 에러
- AI 서비스가 실패 응답 반환
- 데이터 검증 실패

## Processor 구조

각 Processor는 다음 구조를 따릅니다:

```typescript
export async function processSummary(job: Job<SummaryJob>): Promise<JobResult> {
  const { articleId, content } = job.data;

  try {
    // AI 서비스 호출
    const response = await axios.post(`${AI_URL}/summarize`, {...});

    return {
      success: true,
      data: response.data,
      processedAt: new Date(),
    };
  } catch (error) {
    // 재시도 가능한 에러는 throw
    if (error.code === 'ECONNREFUSED') {
      throw error;
    }

    // 재시도 불가능한 에러는 JobResult 반환
    return {
      success: false,
      error: error.message,
      processedAt: new Date(),
    };
  }
}
```

## 모니터링

### BullMQ Board (Optional)

```bash
npm install -g bull-board
bull-board
```

브라우저에서 `http://localhost:3000` 접속

## 트러블슈팅

### Worker가 Job을 처리하지 않음

1. Redis 연결 확인:
   ```bash
   docker exec -it fans_redis redis-cli ping
   ```

2. 큐에 Job이 있는지 확인:
   ```bash
   docker exec -it fans_redis redis-cli LLEN bull:ai-summary:wait
   ```

3. Worker 로그 확인:
   ```bash
   docker logs -f fans_ai_worker
   ```

### AI 서비스 연결 실패

환경변수 확인:
```bash
docker exec fans_ai_worker env | grep AI_URL
```

AI 서비스가 실행 중인지 확인:
```bash
curl http://localhost:8000/health
curl http://localhost:8002/health
```

## 참고

- [BullMQ 공식 문서](https://docs.bullmq.io/)
- [Redis 공식 문서](https://redis.io/documentation)
