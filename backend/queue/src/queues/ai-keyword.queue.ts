import { Queue } from 'bullmq';
import { redisConnection } from '../config/bullmq';
import { QUEUE_NAMES, QUEUE_OPTIONS } from '../config/queue-names';
import { KeywordJob } from '../types/job.types';

/**
 * AI 키워드 추출 Queue
 * 기사의 핵심 키워드를 추출하는 작업을 비동기로 처리
 */
export const aiKeywordQueue = new Queue<KeywordJob>(
  QUEUE_NAMES.AI_KEYWORD,
  {
    connection: redisConnection,
    defaultJobOptions: QUEUE_OPTIONS.defaultJobOptions
  }
);

/**
 * 단일 키워드 추출 작업 추가
 */
export async function addKeywordJob(data: KeywordJob): Promise<string> {
  const job = await aiKeywordQueue.add('extract-keywords', data, {
    priority: 4,
    jobId: `keyword-${data.articleId}`,
    removeOnComplete: true,
    removeOnFail: false
  });
  return job.id!;
}

/**
 * 배치 키워드 추출 작업 추가
 */
export async function addBatchKeywordJobs(jobs: KeywordJob[]): Promise<string[]> {
  const bulkJobs = jobs.map(data => ({
    name: 'extract-keywords',
    data,
    opts: {
      priority: 3,
      jobId: `keyword-${data.articleId}`,
      removeOnComplete: true,
      removeOnFail: false
    }
  }));

  const result = await aiKeywordQueue.addBulk(bulkJobs);
  return result.map(job => job.id!);
}
