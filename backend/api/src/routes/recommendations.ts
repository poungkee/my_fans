import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import { addRecommendationJob } from '@fans/queue';
import { AppDataSource } from '../config/database';
import logger from '../config/logger';

const router = Router();

/**
 * 개인화 추천 뉴스
 * GET /api/recommendations
 * Queue 기반 비동기 처리
 */
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 20;

    // 1. 캐시된 추천 조회 (user_recommendations 테이블)
    const cachedRecommendations = await AppDataSource.query(
      `SELECT na.*, ur.score, ur.created_at as recommended_at
       FROM user_recommendations ur
       JOIN news_articles na ON ur.article_id = na.id
       WHERE ur.user_id = $1
       ORDER BY ur.score DESC, ur.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    // 2. 캐시가 있으면 반환
    if (cachedRecommendations.length > 0) {
      logger.info(`Returning cached recommendations for user ${userId}`);
      return res.json({
        success: true,
        data: {
          recommendations: cachedRecommendations,
          count: cachedRecommendations.length,
          generated_at: cachedRecommendations[0]?.recommended_at || new Date().toISOString(),
          cached: true
        }
      });
    }

    // 3. 캐시가 없으면 Queue에 Job 추가
    logger.info(`No cached recommendations for user ${userId}, adding to queue`);
    await addRecommendationJob({
      userId,
      limit,
      priority: 'high',
      trigger: 'user_request'
    });

    return res.json({
      success: true,
      data: {
        recommendations: [],
        count: 0,
        generated_at: new Date().toISOString(),
        cached: false,
        message: '추천 생성 중입니다. 잠시 후 다시 시도해주세요.'
      }
    });
  } catch (error: any) {
    logger.error('Recommendations API error:', error);
    return res.status(500).json({
      success: false,
      error: '추천 생성 중 오류가 발생했습니다.'
    });
  }
});

/**
 * 추천 새로고침 (캐시 무효화 및 재생성)
 * POST /api/recommendations/refresh
 */
router.post('/refresh', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.body.limit as string) || 20;

    // 1. 캐시 삭제
    await AppDataSource.query(
      `DELETE FROM user_recommendations WHERE user_id = $1`,
      [userId]
    );

    // 2. Queue에 high priority Job 추가
    await addRecommendationJob({
      userId,
      limit,
      priority: 'high',
      trigger: 'user_request'
    });

    logger.info(`Refreshed recommendations for user ${userId}`);

    return res.json({
      success: true,
      message: '추천이 새로고침되었습니다. 잠시 후 다시 확인해주세요.'
    });
  } catch (error: any) {
    logger.error('Recommendations refresh error:', error);
    return res.status(500).json({
      success: false,
      error: '추천 새로고침 중 오류가 발생했습니다.'
    });
  }
});

export default router;
