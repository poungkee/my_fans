import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import { RecommendationService } from '../services/recommendationService';
import logger from '../config/logger';

const router = Router();
const recommendationService = new RecommendationService();

/**
 * 개인화 추천 뉴스
 * GET /api/recommendations
 * Queue 기반 비동기 처리
 */
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 20;

    // RecommendationService 사용 (캐시, Cold Start, 추천 생성 모두 처리)
    logger.info(`Getting recommendations for user ${userId}`);
    const recommendations = await recommendationService.getPersonalizedRecommendations(userId, limit);

    return res.json({
      success: true,
      data: {
        recommendations,
        count: recommendations.length,
        generated_at: new Date().toISOString()
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

    // 캐시 무효화 후 새로운 추천 생성
    logger.info(`Refreshing recommendations for user ${userId}`);
    await recommendationService.clearCache(userId);
    const recommendations = await recommendationService.getPersonalizedRecommendations(userId, limit);

    return res.json({
      success: true,
      data: {
        recommendations,
        count: recommendations.length,
        generated_at: new Date().toISOString()
      },
      message: '추천이 새로고침되었습니다.'
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
