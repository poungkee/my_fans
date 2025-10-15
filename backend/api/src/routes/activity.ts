import { Router, Response } from 'express';
import { AppDataSource } from '../config/database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import logger from '../config/logger';

const router = Router();

/**
 * 사용자 활동 로깅 API
 * 조회, 좋아요, 북마크, 공유 등의 행동을 기록
 */

// 기사 조회 기록
router.post('/view', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { articleId, readingTime = 0 } = req.body;

    if (!articleId) {
      return res.status(400).json({ success: false, error: 'articleId is required' });
    }

    // User-Agent를 50자로 제한
    const userAgent = (req.headers['user-agent'] || 'unknown').substring(0, 50);

    await AppDataSource.query(
      `INSERT INTO user_activity_log (user_id, article_id, activity_type, reading_time_seconds, device_type, ip_address)
       VALUES ($1, $2, 'view', $3, $4, $5)`,
      [userId, articleId, readingTime, userAgent, req.ip]
    );

    logger.info(`User ${userId} viewed article ${articleId}`);

    return res.json({ success: true, message: 'Activity logged' });
  } catch (error: any) {
    logger.error('View activity error:', error);
    return res.status(500).json({ success: false, error: 'Failed to log activity' });
  }
});

// 기사 좋아요
router.post('/like', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { articleId } = req.body;

    if (!articleId) {
      return res.status(400).json({ success: false, error: 'articleId is required' });
    }

    // 중복 좋아요 체크
    const existing = await AppDataSource.query(
      `SELECT id FROM user_activity_log
       WHERE user_id = $1 AND article_id = $2 AND activity_type = 'like'
       ORDER BY created_at DESC LIMIT 1`,
      [userId, articleId]
    );

    if (existing.length > 0) {
      return res.json({ success: true, message: 'Already liked', alreadyLiked: true });
    }

    await AppDataSource.query(
      `INSERT INTO user_activity_log (user_id, article_id, activity_type, ip_address)
       VALUES ($1, $2, 'like', $3)`,
      [userId, articleId, req.ip]
    );

    // article_stats 테이블 업데이트
    await AppDataSource.query(
      `UPDATE article_stats SET like_count = like_count + 1 WHERE article_id = $1`,
      [articleId]
    );

    logger.info(`User ${userId} liked article ${articleId}`);

    return res.json({ success: true, message: 'Liked successfully' });
  } catch (error: any) {
    logger.error('Like activity error:', error);
    return res.status(500).json({ success: false, error: 'Failed to log like' });
  }
});

// 기사 좋아요 취소
router.delete('/like/:articleId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const articleId = parseInt(req.params.articleId);

    // 좋아요 기록 삭제 (소프트 삭제 대신 실제 삭제)
    const result = await AppDataSource.query(
      `DELETE FROM user_activity_log
       WHERE user_id = $1 AND article_id = $2 AND activity_type = 'like'`,
      [userId, articleId]
    );

    if (result[1] === 0) {
      return res.status(404).json({ success: false, error: 'Like not found' });
    }

    // article_stats 테이블 업데이트
    await AppDataSource.query(
      `UPDATE article_stats SET like_count = GREATEST(like_count - 1, 0) WHERE article_id = $1`,
      [articleId]
    );

    logger.info(`User ${userId} unliked article ${articleId}`);

    return res.json({ success: true, message: 'Unliked successfully' });
  } catch (error: any) {
    logger.error('Unlike activity error:', error);
    return res.status(500).json({ success: false, error: 'Failed to unlike' });
  }
});

// 북마크
router.post('/bookmark', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { articleId } = req.body;

    if (!articleId) {
      return res.status(400).json({ success: false, error: 'articleId is required' });
    }

    // 중복 북마크 체크
    const existing = await AppDataSource.query(
      `SELECT id FROM bookmarks WHERE user_id = $1 AND article_id = $2`,
      [userId, articleId]
    );

    if (existing.length > 0) {
      return res.json({ success: true, message: 'Already bookmarked', alreadyBookmarked: true });
    }

    // bookmarks 테이블에 추가
    await AppDataSource.query(
      `INSERT INTO bookmarks (user_id, article_id) VALUES ($1, $2)`,
      [userId, articleId]
    );

    // 활동 로그 기록
    await AppDataSource.query(
      `INSERT INTO user_activity_log (user_id, article_id, activity_type, ip_address)
       VALUES ($1, $2, 'bookmark', $3)`,
      [userId, articleId, req.ip]
    );

    // article_stats 테이블 업데이트
    await AppDataSource.query(
      `UPDATE article_stats SET bookmark_count = bookmark_count + 1 WHERE article_id = $1`,
      [articleId]
    );

    logger.info(`User ${userId} bookmarked article ${articleId}`);

    return res.json({ success: true, message: 'Bookmarked successfully' });
  } catch (error: any) {
    logger.error('Bookmark activity error:', error);
    return res.status(500).json({ success: false, error: 'Failed to bookmark' });
  }
});

// 공유 기록
router.post('/share', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { articleId, platform } = req.body;

    if (!articleId) {
      return res.status(400).json({ success: false, error: 'articleId is required' });
    }

    // Platform을 50자로 제한
    const platformName = (platform || 'unknown').substring(0, 50);

    await AppDataSource.query(
      `INSERT INTO user_activity_log (user_id, article_id, activity_type, device_type, ip_address)
       VALUES ($1, $2, 'share', $3, $4)`,
      [userId, articleId, platformName, req.ip]
    );

    logger.info(`User ${userId} shared article ${articleId} on ${platform}`);

    return res.json({ success: true, message: 'Share logged' });
  } catch (error: any) {
    logger.error('Share activity error:', error);
    return res.status(500).json({ success: false, error: 'Failed to log share' });
  }
});

// 사용자 활동 요약 조회
router.get('/summary', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const summary = await AppDataSource.query(
      `SELECT * FROM user_activity_summary WHERE user_id = $1`,
      [userId]
    );

    if (summary.length === 0) {
      return res.json({
        success: true,
        data: {
          total_activities: 0,
          unique_articles_viewed: 0,
          view_count: 0,
          like_count: 0,
          bookmark_count: 0,
          avg_reading_time: 0
        }
      });
    }

    return res.json({ success: true, data: summary[0] });
  } catch (error: any) {
    logger.error('Activity summary error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get activity summary' });
  }
});

// 사용자가 좋아요한 기사 목록
router.get('/liked-articles', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const articles = await AppDataSource.query(
      `SELECT DISTINCT ON (ual.article_id)
        na.id, na.title, na.url, na.summary, na.image_url, na.published_at,
        s.name as source_name, s.logo_url as source_logo,
        c.name as category_name,
        ual.created_at as liked_at
      FROM user_activity_log ual
      JOIN news_articles na ON ual.article_id = na.id
      LEFT JOIN sources s ON na.source_id = s.id
      LEFT JOIN categories c ON na.category_id = c.id
      WHERE ual.user_id = $1 AND ual.activity_type = 'like'
      ORDER BY ual.article_id, ual.created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return res.json({ success: true, data: articles });
  } catch (error: any) {
    logger.error('Liked articles error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get liked articles' });
  }
});

export default router;
