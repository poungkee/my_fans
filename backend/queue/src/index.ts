/**
 * BullMQ Queue System Entry Point
 * Person A (Producer) / Person B (Consumer) 공통 사용
 */

// Queue 인스턴스
export {
  aiSummaryQueue,
  addSummaryJob,
  addBatchSummaryJobs
} from './queues/ai-summary.queue';

export {
  aiBiasQueue,
  addBiasJob,
  addBatchBiasJobs
} from './queues/ai-bias.queue';

export {
  aiKeywordQueue,
  addKeywordJob,
  addBatchKeywordJobs
} from './queues/ai-keyword.queue';

export {
  aiRecommendationQueue,
  addRecommendationJob,
  addBatchRecommendationJobs
} from './queues/ai-recommendation.queue';

// 타입 정의
export type {
  SummaryJob,
  BiasJob,
  KeywordJob,
  RecommendationJob,
  JobResult
} from './types/job.types';

// 설정
export { QUEUE_NAMES, QUEUE_OPTIONS } from './config/queue-names';
export { redisConnection, REDIS_CONFIG } from './config/bullmq';
