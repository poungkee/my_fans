import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { NewsArticle } from '../entities/NewsArticle';
import { Bookmark } from '../entities/Bookmark';
import { UserAction, ActionType } from '../entities/UserAction';
import { ArticleStat } from '../entities/ArticleStat';
import { AIRecommendation } from '../entities/AIRecommendation';
import { Comment } from '../entities/Comment';
import logger from '../config/logger';

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
    logger.error('북마크 조회 에러:', error);
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
      // 이미 북마크가 있는지 확인
      const existingBookmark = await bookmarkRepo.findOne({
        where: { userId, newsId }
      });

      if (existingBookmark) {
        return res.json({
          success: true,
          message: '기사가 북마크에 추가되었습니다.'
        });
      }

      // 북마크 추가
      const bookmark = bookmarkRepo.create({
        userId,
        newsId
      });
      await bookmarkRepo.save(bookmark);

      // UserAction에도 기록 (트리거가 자동으로 처리하지만 명시적으로도 가능)
      try {
        const userAction = userActionRepo.create({
          userId,
          articleId: newsId,
          actionType: ActionType.BOOKMARK
        });
        await userActionRepo.save(userAction);
      } catch (actionError) {
        // UserAction 저장 실패는 무시 (북마크는 이미 성공)
        logger.warn('UserAction 저장 실패:', actionError);
      }

      // 추천 캐시 무효화 (북마크 추가 시 추천 갱신 필요)
      try {
        await AppDataSource.query(
          'DELETE FROM user_recommendations WHERE user_id = $1',
          [userId]
        );
      } catch (cacheError) {
        logger.warn('추천 캐시 삭제 실패:', cacheError);
      }

      res.json({
        success: true,
        message: '기사가 북마크에 추가되었습니다.'
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
  } catch (error: any) {
    logger.error('북마크 처리 에러:', error);

    // 중복 키 에러 처리 (PostgreSQL)
    if (error.code === '23505') {
      return res.json({
        success: true,
        message: '기사가 북마크에 추가되었습니다.'
      });
    }

    res.status(500).json({
      success: false,
      error: '북마크 처리 중 오류가 발생했습니다.'
    });
  }
});

// 좋아요/싫어요 처리
router.post('/reaction/:newsId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const userId = req.user!.userId;
    const newsId = parseInt(req.params.newsId);
    const { type } = req.body; // 'like', 'dislike', 'remove'

    logger.info(`반응 처리 요청 시작 - userId: ${userId}, newsId: ${newsId}, type: ${type}`);

    const userActionRepo = queryRunner.manager.getRepository(UserAction);

    // 현재 사용자의 반응 상태 조회
    logger.info(`반응 상태 조회 시작 - userId: ${userId}, newsId: ${newsId}`);
    const existingLike = await userActionRepo.findOne({
      where: { userId, articleId: newsId, actionType: ActionType.LIKE }
    });
    const existingDislike = await userActionRepo.findOne({
      where: { userId, articleId: newsId, actionType: ActionType.DISLIKE }
    });
    logger.info(`기존 반응 상태 - 좋아요: ${!!existingLike}, 싫어요: ${!!existingDislike}`);

    if (type === 'like') {
      // 기존 싫어요 제거
      if (existingDislike) {
        await userActionRepo.remove(existingDislike);
      }

      // 이미 좋아요가 있으면 제거, 없으면 추가
      if (existingLike) {
        await userActionRepo.remove(existingLike);
        await queryRunner.commitTransaction();

        // 업데이트된 통계 조회 (트랜잭션 커밋 후 일반 AppDataSource 사용)
        const articleStatRepo = AppDataSource.getRepository(ArticleStat);
        const stats = await articleStatRepo.findOne({ where: { articleId: newsId } });

        res.json({
          success: true,
          message: '좋아요가 취소되었습니다.',
          action: 'removed',
          data: {
            likeCount: stats?.likeCount || 0,
            dislikeCount: stats?.dislikeCount || 0
          }
        });
      } else {
        const likeAction = userActionRepo.create({
          userId,
          articleId: newsId,
          actionType: ActionType.LIKE
        });
        await userActionRepo.save(likeAction);
        await queryRunner.commitTransaction();

        // 추천 캐시 무효화 (좋아요 추가 시 추천 갱신 필요)
        try {
          await AppDataSource.query(
            'DELETE FROM user_recommendations WHERE user_id = $1',
            [userId]
          );
        } catch (cacheError) {
          logger.warn('추천 캐시 삭제 실패:', cacheError);
        }

        // 업데이트된 통계 조회 (트랜잭션 커밋 후 일반 AppDataSource 사용)
        const articleStatRepo = AppDataSource.getRepository(ArticleStat);
        const stats = await articleStatRepo.findOne({ where: { articleId: newsId } });

        res.json({
          success: true,
          message: '좋아요가 추가되었습니다.',
          action: 'added',
          data: {
            likeCount: stats?.likeCount || 0,
            dislikeCount: stats?.dislikeCount || 0
          }
        });
      }
    } else if (type === 'dislike') {
      // 기존 좋아요 제거
      if (existingLike) {
        await userActionRepo.remove(existingLike);
      }

      // 이미 싫어요가 있으면 제거, 없으면 추가
      if (existingDislike) {
        await userActionRepo.remove(existingDislike);
        await queryRunner.commitTransaction();

        // 업데이트된 통계 조회 (트랜잭션 커밋 후 일반 AppDataSource 사용)
        const articleStatRepo = AppDataSource.getRepository(ArticleStat);
        const stats = await articleStatRepo.findOne({ where: { articleId: newsId } });

        res.json({
          success: true,
          message: '싫어요가 취소되었습니다.',
          action: 'removed',
          data: {
            likeCount: stats?.likeCount || 0,
            dislikeCount: stats?.dislikeCount || 0
          }
        });
      } else {
        const dislikeAction = userActionRepo.create({
          userId,
          articleId: newsId,
          actionType: ActionType.DISLIKE
        });
        await userActionRepo.save(dislikeAction);
        await queryRunner.commitTransaction();

        // 추천 캐시 무효화 (싫어요 추가 시 추천 갱신 필요)
        try {
          await AppDataSource.query(
            'DELETE FROM user_recommendations WHERE user_id = $1',
            [userId]
          );
        } catch (cacheError) {
          logger.warn('추천 캐시 삭제 실패:', cacheError);
        }

        // 업데이트된 통계 조회 (트랜잭션 커밋 후 일반 AppDataSource 사용)
        const articleStatRepo = AppDataSource.getRepository(ArticleStat);
        const stats = await articleStatRepo.findOne({ where: { articleId: newsId } });

        res.json({
          success: true,
          message: '싫어요가 추가되었습니다.',
          action: 'added',
          data: {
            likeCount: stats?.likeCount || 0,
            dislikeCount: stats?.dislikeCount || 0
          }
        });
      }
    } else if (type === 'remove') {
      // 모든 반응 제거
      if (existingLike) {
        await userActionRepo.remove(existingLike);
      }
      if (existingDislike) {
        await userActionRepo.remove(existingDislike);
      }

      await queryRunner.commitTransaction();
      res.json({
        success: true,
        message: '반응이 제거되었습니다.',
        action: 'removed'
      });
    } else {
      await queryRunner.rollbackTransaction();
      res.status(400).json({
        success: false,
        error: '잘못된 반응 타입입니다.'
      });
    }
  } catch (error) {
    await queryRunner.rollbackTransaction();
    logger.error('반응 처리 에러:', error);
    res.status(500).json({
      success: false,
      error: '반응 처리 중 오류가 발생했습니다.'
    });
  } finally {
    await queryRunner.release();
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

    // 추천 캐시 무효화 (기사 읽기 활동 시 추천 갱신 필요)
    try {
      await AppDataSource.query(
        'DELETE FROM user_recommendations WHERE user_id = $1',
        [userId]
      );
    } catch (cacheError) {
      logger.warn('추천 캐시 삭제 실패:', cacheError);
    }

    res.json({
      success: true,
      message: '조회 기록이 저장되었습니다.'
    });
  } catch (error) {
    logger.error('조회 기록 에러:', error);
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
    logger.error('히스토리 조회 에러:', error);
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
    logger.error('추천 조회 에러:', error);
    res.status(500).json({
      success: false,
      error: '추천 목록을 가져오는 중 오류가 발생했습니다.'
    });
  }
});

// 특정 기사에 대한 사용자 반응 상태 조회
router.get('/reactions/:newsId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const newsId = parseInt(req.params.newsId);

    const userActionRepo = AppDataSource.getRepository(UserAction);
    const articleStatRepo = AppDataSource.getRepository(ArticleStat);

    // 현재 사용자의 반응 상태 조회
    const userLike = await userActionRepo.findOne({
      where: { userId, articleId: newsId, actionType: ActionType.LIKE }
    });
    const userDislike = await userActionRepo.findOne({
      where: { userId, articleId: newsId, actionType: ActionType.DISLIKE }
    });

    // 전체 좋아요/싫어요 수 조회
    const articleStats = await articleStatRepo.findOne({
      where: { articleId: newsId }
    });

    res.json({
      success: true,
      data: {
        isLiked: !!userLike,
        isDisliked: !!userDislike,
        likeCount: articleStats?.likeCount || 0,
        dislikeCount: articleStats?.dislikeCount || 0
      }
    });
  } catch (error) {
    logger.error('반응 상태 조회 에러:', error);
    res.status(500).json({
      success: false,
      error: '반응 상태를 조회하는 중 오류가 발생했습니다.'
    });
  }
});

// 사용자 댓글 목록 조회
router.get('/comments', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const commentRepo = AppDataSource.getRepository(Comment);

    const comments = await commentRepo.createQueryBuilder('comment')
      .leftJoinAndSelect('comment.article', 'article')
      .where('comment.userId = :userId', { userId })
      .orderBy('comment.createdAt', 'DESC')
      .limit(limit)
      .offset(offset)
      .getMany();

    const commentList = comments.map(comment => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      article: {
        id: comment.article.id,
        title: comment.article.title,
        url: comment.article.url,
        source: comment.article.source,
        category: comment.article.category
      },
      likeCount: comment.likeCount
    }));

    res.json({
      success: true,
      data: {
        comments: commentList,
        total: commentList.length
      }
    });
  } catch (error) {
    logger.error('사용자 댓글 조회 에러:', error);
    res.status(500).json({
      success: false,
      error: '댓글 목록을 가져오는 중 오류가 발생했습니다.'
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
    logger.error('추천 피드백 에러:', error);
    res.status(500).json({
      success: false,
      error: '피드백 저장 중 오류가 발생했습니다.'
    });
  }
});

// 사용자의 좋아요/싫어요 목록 조회
router.get('/reactions', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const userActionRepo = AppDataSource.getRepository(UserAction);
    const reactions = await userActionRepo.createQueryBuilder('action')
      .leftJoinAndSelect('action.article', 'article')
      .leftJoinAndSelect('article.source', 'source')
      .leftJoinAndSelect('article.category', 'category')
      .where('action.userId = :userId', { userId })
      .andWhere('action.actionType IN (:...types)', { types: ['LIKE', 'DISLIKE'] })
      .orderBy('action.createdAt', 'DESC')
      .getMany();

    const reactionList = reactions.map(reaction => ({
      id: reaction.id,
      type: reaction.actionType,
      createdAt: reaction.createdAt,
      article: {
        id: reaction.article.id,
        title: reaction.article.title,
        url: reaction.article.url,
        imageUrl: reaction.article.imageUrl,
        source: reaction.article.source?.name || '알 수 없음',
        category: reaction.article.category?.name || '기타'
      }
    }));

    res.json({
      success: true,
      data: {
        reactions: reactionList,
        total: reactionList.length
      }
    });
  } catch (error) {
    logger.error('사용자 반응 조회 에러:', error);
    res.status(500).json({
      success: false,
      error: '반응 목록을 가져오는 중 오류가 발생했습니다.'
    });
  }
});

export default router;