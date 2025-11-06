import { Job } from 'bullmq';
import axios from 'axios';
import { logger } from '../utils/logger';
import { BiasJob, JobResult } from '@fans/queue';

const BIAS_ANALYSIS_AI_URL = process.env.BIAS_ANALYSIS_AI_URL || 'http://localhost:8002';

export async function processBias(job: Job<BiasJob>): Promise<JobResult> {
  const { articleId, content, categoryName, sourceName } = job.data;

  // Remove "기타-" prefix from source name for AI analysis
  const cleanSourceName = sourceName?.replace(/^기타-/, '') || '기타';

  logger.info(`Processing bias analysis for article ${articleId}`);

  try {
    // AI 편향성 분석 서비스 호출 (엔드포인트: /analyze/full)
    const response = await axios.post(
      `${BIAS_ANALYSIS_AI_URL}/analyze/full`,
      {
        text: content,
        article_id: articleId,
        category: categoryName || '정치',
        source_name: cleanSourceName,
      },
      {
        timeout: 30000,
      }
    );

    if (!response.data) {
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
