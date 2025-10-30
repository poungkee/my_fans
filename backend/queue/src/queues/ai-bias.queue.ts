import { Queue } from 'bullmq';
import { redisConnection } from '../config/bullmq';
import { QUEUE_NAMES, QUEUE_OPTIONS } from '../config/queue-names';
import { BiasJob } from '../types/job.types';

/**
 * AI 편향 분석 Queue
 * Crawler가 기사 저장 후 편향 분석을 비동기로 처리
 */
export const aiBiasQueue = new Queue<BiasJob>(
  QUEUE_NAMES.AI_BIAS,
  {
    connection: redisConnection,
    defaultJobOptions: QUEUE_OPTIONS.defaultJobOptions
  }
);

/**
 * 단일 편향 분석 작업 추가
 */
export async function addBiasJob(data: BiasJob): Promise<string> {
  const job = await aiBiasQueue.add('analyze-bias', data, {
    priority: 5,
    jobId: `bias-${data.articleId}`,
    removeOnComplete: true,
    removeOnFail: false
  });
  return job.id!;
}

/**
 * 배치 편향 분석 작업 추가 (Scheduler에서 사용)
 */
export async function addBatchBiasJobs(jobs: BiasJob[]): Promise<string[]> {
  const bulkJobs = jobs.map(data => ({
    name: 'analyze-bias',
    data,
    opts: {
      priority: 3,
      jobId: `bias-${data.articleId}`,
      removeOnComplete: true,
      removeOnFail: false
    }
  }));

  const result = await aiBiasQueue.addBulk(bulkJobs);
  return result.map(job => job.id!);
}
