import { Job } from 'bullmq';
import axios from 'axios';
import { logger } from '../utils/logger';
import { BiasJob, JobResult } from '../../../queue/src/types/job.types';

const BIAS_ANALYSIS_AI_URL = process.env.BIAS_ANALYSIS_AI_URL || 'http://localhost:8002';

export async function processBias(job: Job<BiasJob>): Promise<JobResult> {
  const { articleId, content, categoryId } = job.data;

  logger.info(`Processing bias analysis for article ${articleId}`);

  try {
    // AI 편향성 분석 서비스 호출
    const response = await axios.post(
      `${BIAS_ANALYSIS_AI_URL}/analyze_bias`,
      {
        article_id: articleId,
        content: content,
        category_id: categoryId,
      },
      {
        timeout: 30000,
      }
    );

    if (!response.data || !response.data.success) {
      throw new Error('AI service returned failure response');
    }

    logger.info(`✅ Bias analysis completed for article ${articleId}`);

    return {
      success: true,
      data: response.data,
      processedAt: new Date(),
    };
  } catch (error: any) {
    logger.error(`❌ Failed to analyze bias for article ${articleId}: ${error.message}`);

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
