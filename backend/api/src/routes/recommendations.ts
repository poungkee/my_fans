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

    // 1. 캐시된 추천 조회 (user_recommendations 테이블 - JSONB 구조)
    const cacheResult = await AppDataSource.query(
      `SELECT recommended_article_ids, recommendation_types, created_at
       FROM user_recommendations
       WHERE user_id = $1 AND expires_at > NOW()`,
      [userId]
    );

    // 2. 캐시가 있으면 기사 정보 가져와서 반환
    if (cacheResult.length > 0) {
      const articleIds = cacheResult[0].recommended_article_ids;
      const types = cacheResult[0].recommendation_types || {};

      if (articleIds && articleIds.length > 0) {
        const articles = await AppDataSource.query(
          `SELECT na.*, s.name as source_name, c.name as category_name
           FROM news_articles na
           LEFT JOIN sources s ON na.source_id = s.id
           LEFT JOIN categories c ON na.category_id = c.id
           WHERE na.id = ANY($1::int[])
           LIMIT $2`,
          [articleIds, limit]
        );

        const recommendations = articles.map((article: any) => ({
          ...article,
          recommendation_type: types[article.id] || 'hybrid'
        }));

        logger.info(`Returning cached recommendations for user ${userId}`);
        return res.json({
          success: true,
          data: {
            recommendations,
            count: recommendations.length,
            generated_at: cacheResult[0].created_at,
            cached: true
          }
        });
      }
    }

    // 3. 캐시가 없으면 Cold Start 확인
    const userProfile = await AppDataSource.query(
      `SELECT preferred_categories, preferred_sources
       FROM user_preferences
       WHERE user_id = $1`,
      [userId]
    );

    const userActivity = await AppDataSource.query(
      `SELECT COUNT(*) as read_count FROM user_read_history WHERE user_id = $1
       UNION ALL
       SELECT COUNT(*) as like_count FROM user_article_likes WHERE user_id = $1`,
      [userId]
    );

    const hasProfile = userProfile.length > 0 &&
                      (userProfile[0].preferred_categories?.length > 0 ||
                       userProfile[0].preferred_sources?.length > 0);
    const totalActivity = userActivity.reduce((sum: number, row: any) => sum + parseInt(row.read_count || row.like_count || 0), 0);

    // 4. Cold Start 사용자 - 즉시 인기 기사 6개 반환
    if (!hasProfile && totalActivity === 0) {
      logger.info(`Cold Start user ${userId}, returning 6 popular articles`);
      const popularArticles = await AppDataSource.query(
        `SELECT na.*, s.name as source_name, c.name as category_name
         FROM news_articles na
         LEFT JOIN sources s ON na.source_id = s.id
         LEFT JOIN categories c ON na.category_id = c.id
         WHERE na.published_at >= NOW() - INTERVAL '7 days'
         ORDER BY na.views DESC, na.published_at DESC
         LIMIT 6`
      );

      const recommendations = popularArticles.map((article: any) => ({
        ...article,
        recommendation_type: 'most_viewed'
      }));

      return res.json({
        success: true,
        data: {
          recommendations,
          count: recommendations.length,
          generated_at: new Date().toISOString(),
          cached: false,
          cold_start: true
        }
      });
    }

    // 5. 프로필 설정 사용자 - Queue에 Job 추가
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
