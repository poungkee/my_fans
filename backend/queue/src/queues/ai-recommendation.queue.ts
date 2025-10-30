import { Queue } from 'bullmq';
import { redisConnection } from '../config/bullmq';
import { QUEUE_NAMES, QUEUE_OPTIONS } from '../config/queue-names';
import { RecommendationJob } from '../types/job.types';

/**
 * AI 추천 Queue
 * 사용자별 맞춤 뉴스 추천을 비동기로 처리
 */
export const aiRecommendationQueue = new Queue<RecommendationJob>(
  QUEUE_NAMES.AI_RECOMMENDATION,
  {
    connection: redisConnection,
    defaultJobOptions: {
      ...QUEUE_OPTIONS.defaultJobOptions,
      attempts: 2,  // 추천은 재시도 2회로 제한
    }
  }
);

/**
 * 단일 추천 작업 추가
 */
export async function addRecommendationJob(data: RecommendationJob): Promise<string> {
  const priorityMap = {
    high: 1,
    normal: 5,
    low: 9
  };

  const job = await aiRecommendationQueue.add('recommend', data, {
    priority: priorityMap[data.priority || 'normal'],
    jobId: `recommend-${data.userId}-${Date.now()}`,
    removeOnComplete: true,
    removeOnFail: false
  });
  return job.id!;
}

/**
 * 배치 추천 작업 추가 (scheduled trigger용)
 */
export async function addBatchRecommendationJobs(jobs: RecommendationJob[]): Promise<string[]> {
  const bulkJobs = jobs.map(data => ({
    name: 'recommend',
    data: {
      ...data,
      trigger: 'scheduled' as const
    },
    opts: {
      priority: 7,  // scheduled는 낮은 우선순위
      jobId: `recommend-${data.userId}-${Date.now()}`,
      removeOnComplete: true,
      removeOnFail: false
    }
  }));

  const result = await aiRecommendationQueue.addBulk(bulkJobs);
  return result.map(job => job.id!);
}
