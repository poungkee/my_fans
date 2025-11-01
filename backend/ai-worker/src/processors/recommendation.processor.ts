import { Job } from 'bullmq';
import axios from 'axios';
import { logger } from '../utils/logger';
import { RecommendationJob, JobResult } from '@fans/queue';

const RECOMMENDATION_AI_URL = process.env.RECOMMENDATION_AI_URL || 'http://localhost:8003';

export async function processRecommendation(job: Job<RecommendationJob>): Promise<JobResult> {
  const { userId, limit, priority, trigger } = job.data;

  logger.info(`Processing recommendation for user ${userId} (priority: ${priority || 'normal'})`);

  try {
    // AI 추천 서비스 호출
    const response = await axios.post(
      `${RECOMMENDATION_AI_URL}/recommend`,
      {
        user_id: userId,
        limit: limit,
        trigger: trigger || 'scheduled',
      },
      {
        timeout: 60000, // 추천은 더 복잡하므로 60초
      }
    );

    if (!response.data || !response.data.success) {
      throw new Error('AI service returned failure response');
    }

    logger.info(`✅ Recommendation completed for user ${userId} (${response.data.recommendations?.length || 0} items)`);

    return {
      success: true,
      data: response.data,
      processedAt: new Date(),
    };
  } catch (error: any) {
    logger.error(`❌ Failed to generate recommendations for user ${userId}: ${error.message}`);

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
