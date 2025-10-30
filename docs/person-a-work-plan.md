# Person A 작업 계획서 (BullMQ Producer 구현)

> **작업 기간**: 약 7.5시간
> **브랜치**: `feature/bullmq-producer`
> **목표**: AI 직접 호출 → BullMQ 큐 기반 비동기 처리로 전환

---

## 📋 작업 개요

### 현재 문제점
- 크롤러에서 AI 서비스 직접 호출 (동기 처리)
- Main API에서 추천 로직 동기 실행 (응답 지연)
- 실패 시 재시도 메커니즘 없음

### 해결 방안
- BullMQ를 사용한 비동기 큐 기반 처리
- Redis를 메시지 브로커로 사용
- 실패 자동 재시도 및 모니터링

### 작업 범위
1. ✅ BullMQ 큐 패키지 생성 (`backend/queue/`)
2. ✅ Crawler AI 호출 제거 → 큐 발행
3. ✅ Main API 추천 로직 → 큐 발행
4. ✅ 테스트 및 검증

---

## 🎯 Phase 1: 준비 작업 (30분)

### 1-1. 작업 브랜치 생성
```bash
cd /Users/hodduk/Documents/git/my_fans
git checkout -b feature/bullmq-producer
```

### 1-2. 디렉토리 구조 생성
```bash
mkdir -p backend/queue/src/{config,queues,types}
touch backend/queue/package.json
touch backend/queue/tsconfig.json
touch backend/queue/src/index.ts
```

### 1-3. package.json 작성
```json
{
  "name": "@fans/queue",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "bullmq": "^5.0.0",
    "ioredis": "^5.3.2"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

### 1-4. tsconfig.json 작성
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "moduleResolution": "node",
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 1-5. 패키지 설치
```bash
cd backend/queue
npm install
```

---

## 🔧 Phase 2: 공통 타입 및 설정 (1시간)

### 2-1. 타입 정의 파일 생성

**파일**: `backend/queue/src/types/job.types.ts`

```typescript
/**
 * BullMQ Job 타입 정의
 * Person A, B 모두 사용
 */

export interface SummaryJob {
  articleId: number;
  content: string;
  retryCount?: number;
}

export interface BiasJob {
  articleId: number;
  content: string;
  categoryId?: number;
  sourceName?: string;
}

export interface KeywordJob {
  articleId: number;
  content: string;
  title: string;
}

export interface RecommendationJob {
  userId: number;
  limit: number;
  priority?: 'high' | 'normal' | 'low';
  trigger?: 'user_request' | 'scheduled';
}

// Job 결과 타입
export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
  processedAt: Date;
}

// Job 메타데이터
export interface JobMetadata {
  createdAt: Date;
  attempts: number;
  lastError?: string;
}
```

### 2-2. 큐 이름 상수 정의

**파일**: `backend/queue/src/config/queue-names.ts`

```typescript
/**
 * BullMQ 큐 이름 상수
 * Person A, B 모두 사용
 */

export const QUEUE_NAMES = {
  AI_SUMMARY: 'ai-summary',
  AI_BIAS: 'ai-bias',
  AI_KEYWORD: 'ai-keyword',
  AI_RECOMMENDATION: 'ai-recommendation'
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

export const QUEUE_OPTIONS = {
  // 기본 재시도 설정
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 5000  // 5초 → 10초 → 20초
    },
    removeOnComplete: {
      age: 3600,  // 1시간 후 삭제
      count: 100  // 최대 100개 보관
    },
    removeOnFail: {
      age: 86400, // 24시간 후 삭제
      count: 1000 // 최대 1000개 보관
    }
  },

  // 우선순위 큐 설정
  priorityOptions: {
    high: 1,
    normal: 5,
    low: 10
  }
} as const;
```

### 2-3. Redis 연결 설정

**파일**: `backend/queue/src/config/bullmq.ts`

```typescript
import { ConnectionOptions } from 'bullmq';

export const redisConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
};

export const REDIS_CONFIG = {
  connection: redisConnection,
  prefix: 'bull'  // Redis 키 prefix
};
```

### 2-4. Git 커밋 (중요!)
```bash
git add backend/queue/src/types/job.types.ts
git add backend/queue/src/config/queue-names.ts
git add backend/queue/src/config/bullmq.ts
git commit -m "feat: BullMQ 공통 타입 및 설정 추가 (Person B와 공유)"
git push origin feature/bullmq-producer
```

---

## 🚀 Phase 3: Queue 구현 (2시간)

### 3-1. AI Summary Queue

**파일**: `backend/queue/src/queues/ai-summary.queue.ts`

```typescript
import { Queue } from 'bullmq';
import { redisConnection } from '../config/bullmq';
import { QUEUE_NAMES, QUEUE_OPTIONS } from '../config/queue-names';
import { SummaryJob, JobResult } from '../types/job.types';

export const aiSummaryQueue = new Queue<SummaryJob>(
  QUEUE_NAMES.AI_SUMMARY,
  {
    connection: redisConnection,
    defaultJobOptions: QUEUE_OPTIONS.defaultJobOptions
  }
);

/**
 * AI 요약 작업 추가
 */
export async function addSummaryJob(data: SummaryJob): Promise<string> {
  const job = await aiSummaryQueue.add('summarize', data, {
    priority: 5,
    jobId: `summary-${data.articleId}`,  // 중복 방지
    removeOnComplete: true
  });

  return job.id!;
}

/**
 * 배치 요약 작업 추가
 */
export async function addBatchSummaryJobs(articles: SummaryJob[]): Promise<string[]> {
  const jobs = articles.map(article => ({
    name: 'summarize',
    data: article,
    opts: {
      priority: 5,
      jobId: `summary-${article.articleId}`
    }
  }));

  const addedJobs = await aiSummaryQueue.addBulk(jobs);
  return addedJobs.map(job => job.id!);
}
```

### 3-2. AI Bias Queue

**파일**: `backend/queue/src/queues/ai-bias.queue.ts`

```typescript
import { Queue } from 'bullmq';
import { redisConnection } from '../config/bullmq';
import { QUEUE_NAMES, QUEUE_OPTIONS } from '../config/queue-names';
import { BiasJob } from '../types/job.types';

export const aiBiasQueue = new Queue<BiasJob>(
  QUEUE_NAMES.AI_BIAS,
  {
    connection: redisConnection,
    defaultJobOptions: QUEUE_OPTIONS.defaultJobOptions
  }
);

/**
 * AI 편향 분석 작업 추가
 */
export async function addBiasJob(data: BiasJob): Promise<string> {
  const job = await aiBiasQueue.add('analyze-bias', data, {
    priority: 5,
    jobId: `bias-${data.articleId}`,
    removeOnComplete: true
  });

  return job.id!;
}

/**
 * 배치 편향 분석 작업 추가
 */
export async function addBatchBiasJobs(articles: BiasJob[]): Promise<string[]> {
  const jobs = articles.map(article => ({
    name: 'analyze-bias',
    data: article,
    opts: {
      priority: 5,
      jobId: `bias-${article.articleId}`
    }
  }));

  const addedJobs = await aiBiasQueue.addBulk(jobs);
  return addedJobs.map(job => job.id!);
}
```

### 3-3. AI Keyword Queue

**파일**: `backend/queue/src/queues/ai-keyword.queue.ts`

```typescript
import { Queue } from 'bullmq';
import { redisConnection } from '../config/bullmq';
import { QUEUE_NAMES, QUEUE_OPTIONS } from '../config/queue-names';
import { KeywordJob } from '../types/job.types';

export const aiKeywordQueue = new Queue<KeywordJob>(
  QUEUE_NAMES.AI_KEYWORD,
  {
    connection: redisConnection,
    defaultJobOptions: QUEUE_OPTIONS.defaultJobOptions
  }
);

/**
 * 키워드 추출 작업 추가
 */
export async function addKeywordJob(data: KeywordJob): Promise<string> {
  const job = await aiKeywordQueue.add('extract-keywords', data, {
    priority: 5,
    jobId: `keyword-${data.articleId}`,
    removeOnComplete: true
  });

  return job.id!;
}

/**
 * 배치 키워드 추출 작업 추가
 */
export async function addBatchKeywordJobs(articles: KeywordJob[]): Promise<string[]> {
  const jobs = articles.map(article => ({
    name: 'extract-keywords',
    data: article,
    opts: {
      priority: 5,
      jobId: `keyword-${article.articleId}`
    }
  }));

  const addedJobs = await aiKeywordQueue.addBulk(jobs);
  return addedJobs.map(job => job.id!);
}
```

### 3-4. AI Recommendation Queue

**파일**: `backend/queue/src/queues/ai-recommendation.queue.ts`

```typescript
import { Queue } from 'bullmq';
import { redisConnection } from '../config/bullmq';
import { QUEUE_NAMES, QUEUE_OPTIONS } from '../config/queue-names';
import { RecommendationJob } from '../types/job.types';

export const aiRecommendationQueue = new Queue<RecommendationJob>(
  QUEUE_NAMES.AI_RECOMMENDATION,
  {
    connection: redisConnection,
    defaultJobOptions: QUEUE_OPTIONS.defaultJobOptions
  }
);

/**
 * 추천 생성 작업 추가
 */
export async function addRecommendationJob(data: RecommendationJob): Promise<string> {
  const priority = data.priority === 'high' ? 1 :
                   data.priority === 'low' ? 10 : 5;

  const job = await aiRecommendationQueue.add('generate-recommendations', data, {
    priority,
    jobId: `recommend-${data.userId}`,
    removeOnComplete: true
  });

  return job.id!;
}
```

### 3-5. Index 파일 (Export)

**파일**: `backend/queue/src/index.ts`

```typescript
// Queues
export { aiSummaryQueue, addSummaryJob, addBatchSummaryJobs } from './queues/ai-summary.queue';
export { aiBiasQueue, addBiasJob, addBatchBiasJobs } from './queues/ai-bias.queue';
export { aiKeywordQueue, addKeywordJob, addBatchKeywordJobs } from './queues/ai-keyword.queue';
export { aiRecommendationQueue, addRecommendationJob } from './queues/ai-recommendation.queue';

// Types
export * from './types/job.types';

// Config
export { QUEUE_NAMES, QUEUE_OPTIONS } from './config/queue-names';
export { redisConnection } from './config/bullmq';
```

### 3-6. 빌드 및 테스트
```bash
cd backend/queue
npm run build

# 빌드 확인
ls -la dist/
```

---

## 🔄 Phase 4: Crawler 수정 (1시간)

### 4-1. package.json 의존성 추가

**파일**: `backend/crawler/crawler-v2/package.json`

```json
{
  "dependencies": {
    ...기존 패키지들,
    "bullmq": "^5.0.0",
    "ioredis": "^5.3.2"
  }
}
```

```bash
cd backend/crawler/crawler-v2
npm install
```

### 4-2. Crawler 코드 수정

**파일**: `backend/crawler/crawler-v2/unifiedCrawlerService.ts`

**수정 위치**: 342-349줄

**기존 코드 (삭제)**:
```typescript
// AI 요약 (비동기, 실패해도 계속)
summarizeArticle(saved.id, article.content).catch((error: any) => {
  logger.error(`AI 요약 실패 (기사 ID: ${saved.id}):`, error);
});

// AI 편향 분석 (비동기, 실패해도 계속)
analyzeBias(saved.id, article.content).catch((error: any) => {
  logger.error(`AI 분석 실패 (기사 ID: ${saved.id}):`, error);
});
```

**새 코드 (추가)**:
```typescript
// BullMQ 큐에 AI 작업 발행 (비동기, 논블로킹)
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../../../queue/src/config/queue-names';

const redisConnection = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

const summaryQueue = new Queue(QUEUE_NAMES.AI_SUMMARY, { connection: redisConnection });
const biasQueue = new Queue(QUEUE_NAMES.AI_BIAS, { connection: redisConnection });
const keywordQueue = new Queue(QUEUE_NAMES.AI_KEYWORD, { connection: redisConnection });

// AI 처리 작업을 큐에 발행
Promise.all([
  summaryQueue.add('summarize', {
    articleId: saved.id,
    content: article.content
  }, {
    jobId: `summary-${saved.id}`,
    removeOnComplete: true
  }),

  biasQueue.add('analyze-bias', {
    articleId: saved.id,
    content: article.content,
    categoryId: categoryId
  }, {
    jobId: `bias-${saved.id}`,
    removeOnComplete: true
  }),

  keywordQueue.add('extract-keywords', {
    articleId: saved.id,
    content: article.content,
    title: article.title
  }, {
    jobId: `keyword-${saved.id}`,
    removeOnComplete: true
  })
]).then(() => {
  logger.info(`✅ AI 작업 큐 발행 완료 (기사 ID: ${saved.id})`);
}).catch((error) => {
  logger.error(`❌ 큐 발행 실패 (기사 ID: ${saved.id}):`, error);
});
```

### 4-3. 빌드 및 테스트
```bash
cd backend/crawler/crawler-v2
npm run build
```

---

## 🎨 Phase 5: Main API 수정 (2시간)

### 5-1. Redis Client 설정

**파일**: `backend/api/src/config/redis.ts` (새로 생성)

```typescript
import Redis from 'ioredis';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'redis',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis 연결 성공');
    });

    redisClient.on('error', (error) => {
      console.error('❌ Redis 연결 오류:', error);
    });
  }

  return redisClient;
}
```

### 5-2. Recommendations Route 수정

**파일**: `backend/api/src/routes/recommendations.ts`

```typescript
import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import { Queue } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { QUEUE_NAMES } from '../../../queue/src/config/queue-names';
import { AppDataSource } from '../config/database';
import logger from '../config/logger';

const router = Router();

// BullMQ 추천 큐
const recommendationQueue = new Queue(QUEUE_NAMES.AI_RECOMMENDATION, {
  connection: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
});

/**
 * 개인화 추천 뉴스 (큐 기반)
 * GET /api/recommendations
 */
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 20;

    logger.info(`Generating recommendations for user ${userId}`);

    const redis = getRedisClient();
    const cacheKey = `recommendations:user:${userId}`;

    // 1. 캐시 확인
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.info(`✅ 캐시된 추천 반환 (user ${userId})`);
      return res.json({
        ...JSON.parse(cached),
        source: 'cache'
      });
    }

    // 2. 큐에 추천 생성 작업 추가
    await recommendationQueue.add('generate-recommendations', {
      userId,
      limit,
      priority: 'high',
      trigger: 'user_request'
    }, {
      jobId: `recommend-${userId}`,
      priority: 1,
      removeOnComplete: true
    });

    logger.info(`🔄 추천 생성 작업 큐에 추가됨 (user ${userId})`);

    // 3. 폴백: 인기 기사 반환
    const popularArticles = await getPopularArticles(limit);

    return res.json({
      success: true,
      data: {
        recommendations: popularArticles,
        count: popularArticles.length,
        status: 'generating',
        message: '맞춤 추천을 생성하고 있습니다. 잠시 후 새로고침해주세요.'
      },
      source: 'fallback'
    });
  } catch (error: any) {
    logger.error('Recommendations API error:', error);
    return res.status(500).json({
      success: false,
      error: '추천 생성 중 오류가 발생했습니다.'
    });
  }
});

/**
 * 추천 완성 상태 확인 (프론트엔드 폴링용)
 * GET /api/recommendations/status
 */
router.get('/status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const redis = getRedisClient();
    const cacheKey = `recommendations:user:${userId}`;

    const cached = await redis.get(cacheKey);

    return res.json({
      success: true,
      data: {
        ready: !!cached,
        timestamp: cached ? Date.now() : null
      }
    });
  } catch (error: any) {
    logger.error('Recommendations status error:', error);
    return res.status(500).json({
      success: false,
      error: '상태 확인 중 오류가 발생했습니다.'
    });
  }
});

/**
 * 추천 새로고침 (캐시 무효화)
 * POST /api/recommendations/refresh
 */
router.post('/refresh', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const redis = getRedisClient();
    const cacheKey = `recommendations:user:${userId}`;

    // 캐시 삭제
    await redis.del(cacheKey);

    logger.info(`Refreshed recommendations cache for user ${userId}`);

    return res.json({
      success: true,
      message: '추천이 새로고침되었습니다.'
    });
  } catch (error: any) {
    logger.error('Recommendations refresh error:', error);
    return res.status(500).json({
      success: false,
      error: '추천 새로고침 중 오류가 발생했습니다.'
    });
  }
});

/**
 * 인기 기사 가져오기 (폴백용)
 */
async function getPopularArticles(limit: number): Promise<any[]> {
  const result = await AppDataSource.query(
    `SELECT na.*,
      s.name as source_name,
      c.name as category_name,
      COUNT(DISTINCT CASE WHEN ual.activity_type = 'view' THEN ual.user_id END) as view_count,
      COUNT(DISTINCT CASE WHEN ual.activity_type = 'like' THEN ual.user_id END) as like_count
    FROM news_articles na
    LEFT JOIN sources s ON na.source_id = s.id
    LEFT JOIN categories c ON na.category_id = c.id
    LEFT JOIN user_activity_log ual ON na.id = ual.article_id
    WHERE na.pub_date > NOW() - INTERVAL '3 days'
    GROUP BY na.id, s.name, c.name
    ORDER BY
      COUNT(DISTINCT CASE WHEN ual.activity_type = 'view' THEN ual.user_id END) DESC,
      na.pub_date DESC
    LIMIT $1`,
    [limit]
  );

  return result.map((article: any) => ({
    ...article,
    recommendation_type: 'popular',
    view_count: parseInt(article.view_count) || 0,
    like_count: parseInt(article.like_count) || 0
  }));
}

export default router;
```

### 5-3. recommendationService.ts 복사 (Person B 전달용)

```bash
# Person B에게 전달할 파일 복사
cp backend/api/src/services/recommendationService.ts \
   docs/person-b-reference-recommendationService.ts

# Git에 추가 (Person B가 참고용으로 사용)
git add docs/person-b-reference-recommendationService.ts
```

---

## 🧪 Phase 6: 테스트 (2시간)

### 6-1. Redis 연결 테스트

```bash
# Redis 실행 확인
docker ps | grep redis

# Redis CLI 접속
docker exec -it fans_redis redis-cli

# Ping 테스트
PING
# 결과: PONG
```

### 6-2. 큐 발행 테스트

```bash
# Crawler 로그 확인 (실시간)
docker logs -f fans_unified_crawler

# 큐 확인 (Redis CLI)
docker exec -it fans_redis redis-cli

# 큐 길이 확인
LLEN bull:ai-summary:wait
LLEN bull:ai-bias:wait
LLEN bull:ai-keyword:wait

# 큐 내용 확인 (첫 번째 작업)
LRANGE bull:ai-summary:wait 0 0
```

### 6-3. Main API 추천 테스트

```bash
# 추천 요청 (로그인 필요)
curl -X GET http://localhost:3000/api/recommendations \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json"

# 추천 상태 확인
curl -X GET http://localhost:3000/api/recommendations/status \
  -H "Authorization: Bearer <YOUR_TOKEN>"

# 큐 확인
docker exec -it fans_redis redis-cli LLEN bull:ai-recommendation:wait
```

### 6-4. 로그 확인

```bash
# Crawler 로그
docker logs fans_unified_crawler --tail 50 | grep "큐 발행"

# Main API 로그
docker logs fans_main_api --tail 50 | grep "추천"

# Redis 키 확인
docker exec -it fans_redis redis-cli KEYS "bull:*"
```

---

## ✅ 최종 체크리스트

### Phase 1: 준비
- [ ] 브랜치 생성 (`feature/bullmq-producer`)
- [ ] `backend/queue/` 디렉토리 구조 생성
- [ ] package.json, tsconfig.json 작성
- [ ] npm install 실행

### Phase 2: 공통 파일
- [ ] `job.types.ts` 작성 완료
- [ ] `queue-names.ts` 작성 완료
- [ ] `bullmq.ts` Redis 설정 완료
- [ ] **Git 커밋 및 푸시** (Person B와 공유)

### Phase 3: Queue 구현
- [ ] `ai-summary.queue.ts` 작성
- [ ] `ai-bias.queue.ts` 작성
- [ ] `ai-keyword.queue.ts` 작성
- [ ] `ai-recommendation.queue.ts` 작성
- [ ] `index.ts` export 완료
- [ ] 빌드 성공 (`npm run build`)

### Phase 4: Crawler 수정
- [ ] Crawler package.json에 bullmq 추가
- [ ] `unifiedCrawlerService.ts` 342-349줄 수정
- [ ] AI 직접 호출 제거
- [ ] 큐 발행 코드 추가
- [ ] 빌드 성공

### Phase 5: Main API 수정
- [ ] `redis.ts` 설정 파일 생성
- [ ] `recommendations.ts` 라우터 수정
- [ ] 캐시 확인 로직 추가
- [ ] 큐 발행 로직 추가
- [ ] 폴백 인기 기사 추가
- [ ] Status API 추가
- [ ] `recommendationService.ts` 복사 (Person B 전달)

### Phase 6: 테스트
- [ ] Redis 연결 확인
- [ ] Crawler 큐 발행 테스트
- [ ] Main API 추천 요청 테스트
- [ ] Redis 큐 확인 (LLEN)
- [ ] 로그 확인

### 최종 커밋
- [ ] 모든 변경사항 커밋
- [ ] Person B에게 알림
- [ ] 머지 전 리뷰 요청

---

## 📤 Person B에게 전달할 자료

### Git에 커밋된 파일
1. ✅ `backend/queue/src/types/job.types.ts`
2. ✅ `backend/queue/src/config/queue-names.ts`
3. ✅ `docs/person-b-reference-recommendationService.ts`

### .env 업데이트 필요
```bash
# environments/local/.env에 추가
REDIS_HOST=redis
REDIS_PORT=6379
WORKER_CONCURRENCY=5
WORKER_RATE_LIMIT_MAX=10
WORKER_RATE_LIMIT_DURATION=1000
```

---

## 🚨 주의사항

1. **브랜치 사용**: 반드시 `feature/bullmq-producer` 브랜치에서 작업
2. **공통 타입 수정 금지**: `job.types.ts`는 Person B와 공유하므로 함부로 수정 금지
3. **Scheduler 유지**: 현재는 Scheduler 제거하지 말 것 (테스트 완료 후)
4. **Redis 필수**: 로컬 Redis가 실행 중이어야 테스트 가능
5. **Git 커밋 타이밍**: Phase 2 완료 후 반드시 커밋 (Person B가 대기 중)

---

## 📞 문제 발생 시 해결 방법

### Redis 연결 오류
```bash
# .env 확인
cat environments/local/.env | grep REDIS

# Redis 컨테이너 확인
docker ps | grep redis

# Redis 재시작
docker restart fans_redis
```

### 큐 발행 실패
```bash
# bullmq 버전 확인
npm list bullmq

# package.json 확인
cat backend/queue/package.json

# 재설치
cd backend/queue
rm -rf node_modules
npm install
```

### 타입 오류
```bash
# 빌드 확인
cd backend/queue
npm run build

# import 경로 확인
# Crawler에서: import { ... } from '../../../queue/src/...'
```

---

## 📊 진행 현황 공유

작업 진행률을 아래 체크리스트로 공유:

- [ ] Phase 1 완료 (30분)
- [ ] Phase 2 완료 + Git 커밋 (1시간)
- [ ] Phase 3 완료 (2시간)
- [ ] Phase 4 완료 (1시간)
- [ ] Phase 5 완료 (2시간)
- [ ] Phase 6 완료 (1시간)
- [ ] Person B에게 전달 완료

**총 예상 시간**: 7.5시간
**실제 소요 시간**: ___시간

---

## 🎉 완료 후 다음 단계

1. ✅ Person B에게 커밋 알림
2. ✅ Person B의 Worker 완성 대기
3. ✅ 통합 테스트
4. ✅ Scheduler 제거
5. ✅ Production 배포
