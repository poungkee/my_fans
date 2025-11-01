import { Job } from 'bullmq';
import axios from 'axios';
import { logger } from '../utils/logger';
import { SummaryJob, JobResult } from '@fans/queue';

const SUMMARIZE_AI_URL = process.env.SUMMARIZE_AI_URL || 'http://localhost:8000';

export async function processSummary(job: Job<SummaryJob>): Promise<JobResult> {
  const { articleId, content } = job.data;

  logger.info(`Processing summary for article ${articleId}`);

  try {
    // AI 요약 서비스 호출 (엔드포인트: /ai/summarize)
    const response = await axios.post(
      `${SUMMARIZE_AI_URL}/ai/summarize`,
      {
        text: content,
        max_length: 150,
      },
      {
        timeout: 30000, // 30초 타임아웃
      }
    );

    if (!response.data || !response.data.summary) {
      throw new Error('AI service returned failure response');
    }

    logger.info(`✅ Summary generated for article ${articleId}`);

    return {
      success: true,
      data: {
        summary: response.data.summary,
        length: response.data.length,
      },
      processedAt: new Date(),
    };
  } catch (error: any) {
    logger.error(`❌ Failed to generate summary for article ${articleId}: ${error.message}`);

    // 재시도 가능한 에러인지 판단
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      throw error; // BullMQ가 재시도함
    }

    return {
      success: false,
      error: error.message,
      processedAt: new Date(),
    };
  }
}
