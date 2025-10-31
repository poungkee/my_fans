import { Job } from 'bullmq';
import axios from 'axios';
import { logger } from '../utils/logger';
import { KeywordJob, JobResult } from '../../../queue/src/types/job.types';

const BIAS_ANALYSIS_AI_URL = process.env.BIAS_ANALYSIS_AI_URL || 'http://localhost:8002';

export async function processKeyword(job: Job<KeywordJob>): Promise<JobResult> {
  const { articleId, content, title } = job.data;

  logger.info(`Processing keyword extraction for article ${articleId}`);

  try {
    // AI 키워드 추출 서비스 호출 (엔드포인트: /analyze/keywords)
    const response = await axios.post(
      `${BIAS_ANALYSIS_AI_URL}/analyze/keywords`,
      {
        text: `${title} ${content}`,
      },
      {
        timeout: 30000,
      }
    );

    if (!response.data || !response.data.keywords) {
      throw new Error('AI service returned failure response');
    }

    logger.info(`✅ Keyword extraction completed for article ${articleId}`);

    return {
      success: true,
      data: {
        keywords: response.data.keywords,
      },
      processedAt: new Date(),
    };
  } catch (error: any) {
    logger.error(`❌ Failed to extract keywords for article ${articleId}: ${error.message}`);

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      throw error;
    }

    return {
      success: false,
      error: error.message,
      processedAt: new Date(),
    };
  }
}
