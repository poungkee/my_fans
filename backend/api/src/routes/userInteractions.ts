import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { NewsArticle } from '../entities/NewsArticle';
import { Bookmark } from '../entities/Bookmark';
import { UserAction, ActionType } from '../entities/UserAction';
import { ArticleStat } from '../entities/ArticleStat';
import { AIRecommendation } from '../entities/AIRecommendation';

const router = Router();

// 사용자의 북마크 목록 조회
router.get('/bookmarks', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const bookmarkRepo = AppDataSource.getRepository(Bookmark);
    const bookmarks = await bookmarkRepo.createQueryBuilder('bookmark')
      .leftJoinAndSelect('bookmark.article', 'article')
      .leftJoinAndSelect('article.source', 'source')
      .leftJoinAndSelect('article.category', 'category')
      .where('bookmark.userId = :userId', { userId })
      .orderBy('bookmark.createdAt', 'DESC')
      .getMany();

    const bookmarkList = bookmarks.map(bookmark => ({
      id: bookmark.article.id,
      title: bookmark.article.title,
      summary: bookmark.article.aiSummary || bookmark.article.content?.substring(0, 100),
      url: bookmark.article.url,
      imageUrl: bookmark.article.imageUrl,
      source: bookmark.article.source?.name || '알 수 없음',
      category: bookmark.article.category?.name || '기타',
      pubDate: bookmark.article.pubDate,
      bookmarkedAt: bookmark.createdAt
    }));

    res.json({
      success: true,
      data: {
        bookmarks: bookmarkList,
        total: bookmarkList.length
      }
    });
  } catch (error) {
    console.error('북마크 조회 에러:', error);
    res.status(500).json({
      success: false,
      error: '북마크 목록을 가져오는 중 오류가 발생했습니다.'
    });
  }
});

// 북마크 추가/제거
router.post('/bookmark/:newsId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const newsId = parseInt(req.params.newsId);
    const { action } = req.body; // 'add' or 'remove'

    const bookmarkRepo = AppDataSource.getRepository(Bookmark);
    const userActionRepo = AppDataSource.getRepository(UserAction);
    const statRepo = AppDataSource.getRepository(ArticleStat);

    if (action === 'add') {
      // 북마크 추가
      const bookmark = bookmarkRepo.create({
        userId,
        newsId
      });
      await bookmarkRepo.save(bookmark);

      // UserAction에도 기록 (트리거가 자동으로 처리하지만 명시적으로도 가능)
      const userAction = userActionRepo.create({
        userId,
        articleId: newsId,
        actionType: ActionType.BOOKMARK
      });
      await userActionRepo.save(userAction);

      res.json({
        success: true,
        message: '북마크가 추가되었습니다.'
      });
    } else if (action === 'remove') {
      // 북마크 제거
      await bookmarkRepo.delete({ userId, newsId });

      res.json({
        success: true,
        message: '북마크가 제거되었습니다.'
      });
    } else {
      res.status(400).json({
        success: false,
        error: '잘못된 액션입니다.'
      });
    }
  } catch (error) {
    console.error('북마크 처리 에러:', error);
    res.status(500).json({
      success: false,
      error: '북마크 처리 중 오류가 발생했습니다.'
    });
  }
});

// 좋아요/싫어요 처리
router.post('/reaction/:newsId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const newsId = parseInt(req.params.newsId);
    const { type } = req.body; // 'like', 'dislike', 'remove'

    const userActionRepo = AppDataSource.getRepository(UserAction);

    if (type === 'like') {
      // 기존 싫어요 제거
      await userActionRepo.delete({ userId, articleId: newsId, actionType: ActionType.DISLIKE });

      // 좋아요 추가
      const likeAction = userActionRepo.create({
        userId,
        articleId: newsId,
        actionType: ActionType.LIKE
      });
      await userActionRepo.save(likeAction);

      res.json({
        success: true,
        message: '좋아요가 추가되었습니다.'
      });
    } else if (type === 'dislike') {
      // 기존 좋아요 제거
      await userActionRepo.delete({ userId, articleId: newsId, actionType: ActionType.LIKE });

      // 싫어요 추가
      const dislikeAction = userActionRepo.create({
        userId,
        articleId: newsId,
        actionType: ActionType.DISLIKE
      });
      await userActionRepo.save(dislikeAction);

      res.json({
        success: true,
        message: '싫어요가 추가되었습니다.'
      });
    } else if (type === 'remove') {
      // 좋아요/싫어요 모두 제거
      await userActionRepo.delete({
        userId,
        articleId: newsId,
        actionType: ActionType.LIKE
      });
      await userActionRepo.delete({
        userId,
        articleId: newsId,
        actionType: ActionType.DISLIKE
      });

      res.json({
        success: true,
        message: '반응이 제거되었습니다.'
      });
    } else {
      res.status(400).json({
        success: false,
        error: '잘못된 반응 타입입니다.'
      });
    }
  } catch (error) {
    console.error('반응 처리 에러:', error);
    res.status(500).json({
      success: false,
      error: '반응 처리 중 오류가 발생했습니다.'
    });
  }
});

// 뉴스 조회 기록
router.post('/view/:newsId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const newsId = parseInt(req.params.newsId);
    const { readingDuration, readingPercentage } = req.body;

    const userActionRepo = AppDataSource.getRepository(UserAction);

    // VIEW 액션 저장 (중복 가능)
    const viewAction = userActionRepo.create({
      userId,
      articleId: newsId,
      actionType: ActionType.VIEW,
      readingDuration,
      readingPercentage
    });
    await userActionRepo.save(viewAction);

    res.json({
      success: true,
      message: '조회 기록이 저장되었습니다.'
    });
  } catch (error) {
    console.error('조회 기록 에러:', error);
    res.status(500).json({
      success: false,
      error: '조회 기록 저장 중 오류가 발생했습니다.'
    });
  }
});

// 사용자 활동 히스토리 조회
router.get('/history', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const userActionRepo = AppDataSource.getRepository(UserAction);

    const actions = await userActionRepo.createQueryBuilder('action')
      .leftJoinAndSelect('action.article', 'article')
      .leftJoinAndSelect('article.source', 'source')
      .leftJoinAndSelect('article.category', 'category')
      .where('action.userId = :userId', { userId })
      .orderBy('action.createdAt', 'DESC')
      .limit(limit)
      .offset(offset)
      .getMany();

    const history = actions.map(action => ({
      id: action.id,
      type: action.actionType,
      article: {
        id: action.article.id,
        title: action.article.title,
        url: action.article.url,
        source: action.article.source?.name,
        category: action.article.category?.name
      },
      readingDuration: action.readingDuration,
      readingPercentage: action.readingPercentage,
      createdAt: action.createdAt
    }));

    res.json({
      success: true,
      data: {
        history,
        total: history.length
      }
    });
  } catch (error) {
    console.error('히스토리 조회 에러:', error);
    res.status(500).json({
      success: false,
      error: '활동 히스토리를 가져오는 중 오류가 발생했습니다.'
    });
  }
});

// AI 추천 목록 조회
router.get('/recommendations', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 20;

    const recommendationRepo = AppDataSource.getRepository(AIRecommendation);

    const recommendations = await recommendationRepo.createQueryBuilder('rec')
      .leftJoinAndSelect('rec.article', 'article')
      .leftJoinAndSelect('article.source', 'source')
      .leftJoinAndSelect('article.category', 'category')
      .leftJoinAndSelect('article.stats', 'stats')
      .where('rec.userId = :userId', { userId })
      .andWhere('rec.wasRead = false')
      .orderBy('rec.recommendationScore', 'DESC')
      .limit(limit)
      .getMany();

    const recommendationList = recommendations.map(rec => ({
      id: rec.article.id,
      title: rec.article.title,
      summary: rec.article.aiSummary,
      url: rec.article.url,
      imageUrl: rec.article.imageUrl,
      source: rec.article.source?.name,
      category: rec.article.category?.name,
      score: rec.recommendationScore,
      reason: rec.recommendationReason,
      viewCount: rec.article.stats?.[0]?.viewCount || 0,
      likeCount: rec.article.stats?.[0]?.likeCount || 0
    }));

    res.json({
      success: true,
      data: {
        recommendations: recommendationList,
        total: recommendationList.length
      }
    });
  } catch (error) {
    console.error('추천 조회 에러:', error);
    res.status(500).json({
      success: false,
      error: '추천 목록을 가져오는 중 오류가 발생했습니다.'
    });
  }
});

// 추천 피드백
router.post('/recommendation-feedback/:newsId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const newsId = parseInt(req.params.newsId);
    const { feedback, wasClicked, wasRead } = req.body; // feedback: -1, 0, 1

    const recommendationRepo = AppDataSource.getRepository(AIRecommendation);

    const recommendation = await recommendationRepo.findOne({
      where: { userId, articleId: newsId }
    });

    if (!recommendation) {
      return res.status(404).json({
        success: false,
        error: '추천 기록을 찾을 수 없습니다.'
      });
    }

    if (feedback !== undefined) recommendation.feedbackScore = feedback;
    if (wasClicked !== undefined) recommendation.wasClicked = wasClicked;
    if (wasRead !== undefined) recommendation.wasRead = wasRead;

    await recommendationRepo.save(recommendation);

    res.json({
      success: true,
      message: '피드백이 저장되었습니다.'
    });
  } catch (error) {
    console.error('추천 피드백 에러:', error);
    res.status(500).json({
      success: false,
      error: '피드백 저장 중 오류가 발생했습니다.'
    });
  }
});

export default router;