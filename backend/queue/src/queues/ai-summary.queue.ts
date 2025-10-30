import { Queue } from 'bullmq';
import { redisConnection } from '../config/bullmq';
import { QUEUE_NAMES, QUEUE_OPTIONS } from '../config/queue-names';
import { SummaryJob } from '../types/job.types';

/**
 * AI 요약 Queue
 * Crawler가 기사 저장 후 요약 작업을 비동기로 처리
 */
export const aiSummaryQueue = new Queue<SummaryJob>(
  QUEUE_NAMES.AI_SUMMARY,
  {
    connection: redisConnection,
    defaultJobOptions: QUEUE_OPTIONS.defaultJobOptions
  }
);

/**
 * 단일 요약 작업 추가
 */
export async function addSummaryJob(data: SummaryJob): Promise<string> {
  const job = await aiSummaryQueue.add('summarize', data, {
    priority: 5,
    jobId: `summary-${data.articleId}`,
    removeOnComplete: true,
    removeOnFail: false
  });
  return job.id!;
}

/**
 * 배치 요약 작업 추가 (Scheduler에서 사용)
 */
export async function addBatchSummaryJobs(jobs: SummaryJob[]): Promise<string[]> {
  const bulkJobs = jobs.map(data => ({
    name: 'summarize',
    data,
    opts: {
      priority: 3,
      jobId: `summary-${data.articleId}`,
      removeOnComplete: true,
      removeOnFail: false
    }
  }));

  const result = await aiSummaryQueue.addBulk(bulkJobs);
  return result.map(job => job.id!);
}
