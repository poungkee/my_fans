import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import { UserInteractionService } from '../services/userInteractionService';
import { AppDataSource } from '../config/database';
import { UserNewsInteraction } from '../entities/UserNewsInteraction';
import { Comment } from '../entities/Comment';
import { NewsArticle } from '../entities/NewsArticle';

const router = Router();
const userInteractionService = new UserInteractionService();

// 사용자의 북마크 목록 조회
router.get('/bookmarks', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    const interactions = await AppDataSource
      .getRepository(UserNewsInteraction)
      .createQueryBuilder('interaction')
      .leftJoinAndSelect('interaction.newsArticle', 'news')
      .leftJoinAndSelect('news.mediaSource', 'mediaSource')
      .leftJoinAndSelect('news.category', 'category')
      .where('interaction.userId = :userId', { userId })
      .andWhere('interaction.isBookmarked = :isBookmarked', { isBookmarked: true })
      .orderBy('interaction.createdAt', 'DESC')
      .getMany();

    const bookmarks = interactions.map(interaction => ({
      id: interaction.newsArticle.id,
      title: interaction.newsArticle.title,
      summary: interaction.newsArticle.summary,
      url: interaction.newsArticle.url,
      imageUrl: interaction.newsArticle.imageUrl,
      mediaSource: interaction.newsArticle.mediaSource?.name || '알 수 없음',
      category: interaction.newsArticle.category?.name || '기타',
      pubDate: interaction.newsArticle.pubDate,
      bookmarkedAt: interaction.createdAt
    }));

    res.json({
      success: true,
      data: {
        bookmarks,
        total: bookmarks.length
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

// 사용자의 좋아요 목록 조회
router.get('/likes', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    const interactions = await AppDataSource
      .getRepository(UserNewsInteraction)
      .createQueryBuilder('interaction')
      .leftJoinAndSelect('interaction.newsArticle', 'news')
      .leftJoinAndSelect('news.mediaSource', 'mediaSource')
      .leftJoinAndSelect('news.category', 'category')
      .where('interaction.userId = :userId', { userId })
      .andWhere('interaction.isLiked = :isLiked', { isLiked: true })
      .orderBy('interaction.createdAt', 'DESC')
      .getMany();

    const likes = interactions.map(interaction => ({
      id: interaction.newsArticle.id,
      title: interaction.newsArticle.title,
      summary: interaction.newsArticle.summary,
      url: interaction.newsArticle.url,
      imageUrl: interaction.newsArticle.imageUrl,
      mediaSource: interaction.newsArticle.mediaSource?.name || '알 수 없음',
      category: interaction.newsArticle.category?.name || '기타',
      pubDate: interaction.newsArticle.pubDate,
      likedAt: interaction.createdAt
    }));

    res.json({
      success: true,
      data: {
        likes,
        total: likes.length
      }
    });
  } catch (error) {
    console.error('좋아요 조회 에러:', error);
    res.status(500).json({
      success: false,
      error: '좋아요 목록을 가져오는 중 오류가 발생했습니다.'
    });
  }
});

// 사용자의 댓글 목록 조회
router.get('/comments', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    const comments = await AppDataSource
      .getRepository(Comment)
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.newsArticle', 'news')
      .leftJoinAndSelect('news.mediaSource', 'mediaSource')
      .leftJoinAndSelect('news.category', 'category')
      .where('comment.userId = :userId', { userId })
      .orderBy('comment.createdAt', 'DESC')
      .getMany();

    const userComments = comments.map(comment => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      news: {
        id: comment.newsArticle.id,
        title: comment.newsArticle.title,
        url: comment.newsArticle.url,
        mediaSource: comment.newsArticle.mediaSource?.name || '알 수 없음',
        category: comment.newsArticle.category?.name || '기타',
        pubDate: comment.newsArticle.pubDate
      }
    }));

    res.json({
      success: true,
      data: {
        comments: userComments,
        total: userComments.length
      }
    });
  } catch (error) {
    console.error('댓글 조회 에러:', error);
    res.status(500).json({
      success: false,
      error: '댓글 목록을 가져오는 중 오류가 발생했습니다.'
    });
  }
});

// 북마크 토글
router.post('/bookmark/:newsId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const newsId = parseInt(req.params.newsId);

    if (isNaN(newsId)) {
      return res.status(400).json({
        success: false,
        error: '올바른 뉴스 ID가 필요합니다.'
      });
    }

    // 뉴스 기사 존재 확인
    const newsArticle = await AppDataSource
      .getRepository(NewsArticle)
      .findOne({ where: { id: newsId } });

    if (!newsArticle) {
      return res.status(404).json({
        success: false,
        error: '뉴스 기사를 찾을 수 없습니다.'
      });
    }

    // 기존 상호작용 확인
    let interaction = await AppDataSource
      .getRepository(UserNewsInteraction)
      .findOne({
        where: { userId, newsArticleId: newsId }
      });

    if (interaction) {
      // 북마크 상태 토글
      interaction.isBookmarked = !interaction.isBookmarked;
      await AppDataSource.getRepository(UserNewsInteraction).save(interaction);
    } else {
      // 새로운 상호작용 생성
      interaction = AppDataSource.getRepository(UserNewsInteraction).create({
        userId,
        newsArticleId: newsId,
        isBookmarked: true,
        isLiked: false
      });
      await AppDataSource.getRepository(UserNewsInteraction).save(interaction);
    }

    res.json({
      success: true,
      message: interaction.isBookmarked ? '북마크에 추가되었습니다.' : '북마크에서 제거되었습니다.',
      data: {
        isBookmarked: interaction.isBookmarked
      }
    });
  } catch (error) {
    console.error('북마크 토글 에러:', error);
    res.status(500).json({
      success: false,
      error: '북마크 처리 중 오류가 발생했습니다.'
    });
  }
});

// 좋아요 토글
router.post('/like/:newsId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const newsId = parseInt(req.params.newsId);

    if (isNaN(newsId)) {
      return res.status(400).json({
        success: false,
        error: '올바른 뉴스 ID가 필요합니다.'
      });
    }

    // 뉴스 기사 존재 확인
    const newsArticle = await AppDataSource
      .getRepository(NewsArticle)
      .findOne({ where: { id: newsId } });

    if (!newsArticle) {
      return res.status(404).json({
        success: false,
        error: '뉴스 기사를 찾을 수 없습니다.'
      });
    }

    // 기존 상호작용 확인
    let interaction = await AppDataSource
      .getRepository(UserNewsInteraction)
      .findOne({
        where: { userId, newsArticleId: newsId }
      });

    if (interaction) {
      // 좋아요 상태 토글
      interaction.isLiked = !interaction.isLiked;
      await AppDataSource.getRepository(UserNewsInteraction).save(interaction);
    } else {
      // 새로운 상호작용 생성
      interaction = AppDataSource.getRepository(UserNewsInteraction).create({
        userId,
        newsArticleId: newsId,
        isBookmarked: false,
        isLiked: true
      });
      await AppDataSource.getRepository(UserNewsInteraction).save(interaction);
    }

    res.json({
      success: true,
      message: interaction.isLiked ? '좋아요를 눌렀습니다.' : '좋아요를 취소했습니다.',
      data: {
        isLiked: interaction.isLiked
      }
    });
  } catch (error) {
    console.error('좋아요 토글 에러:', error);
    res.status(500).json({
      success: false,
      error: '좋아요 처리 중 오류가 발생했습니다.'
    });
  }
});

// 댓글 작성
router.post('/comment/:newsId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const newsId = parseInt(req.params.newsId);
    const { content } = req.body;

    if (isNaN(newsId)) {
      return res.status(400).json({
        success: false,
        error: '올바른 뉴스 ID가 필요합니다.'
      });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '댓글 내용을 입력해주세요.'
      });
    }

    if (content.length > 500) {
      return res.status(400).json({
        success: false,
        error: '댓글은 500자 이하로 작성해주세요.'
      });
    }

    // 뉴스 기사 존재 확인
    const newsArticle = await AppDataSource
      .getRepository(NewsArticle)
      .findOne({ where: { id: newsId } });

    if (!newsArticle) {
      return res.status(404).json({
        success: false,
        error: '뉴스 기사를 찾을 수 없습니다.'
      });
    }

    // 댓글 생성
    const comment = AppDataSource.getRepository(Comment).create({
      userId,
      newsArticleId: newsId,
      content: content.trim()
    });

    const savedComment = await AppDataSource.getRepository(Comment).save(comment);

    res.json({
      success: true,
      message: '댓글이 작성되었습니다.',
      data: {
        comment: {
          id: savedComment.id,
          content: savedComment.content,
          createdAt: savedComment.createdAt
        }
      }
    });
  } catch (error) {
    console.error('댓글 작성 에러:', error);
    res.status(500).json({
      success: false,
      error: '댓글 작성 중 오류가 발생했습니다.'
    });
  }
});

// 댓글 삭제
router.delete('/comment/:commentId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const commentId = parseInt(req.params.commentId);

    if (isNaN(commentId)) {
      return res.status(400).json({
        success: false,
        error: '올바른 댓글 ID가 필요합니다.'
      });
    }

    // 댓글 존재 및 소유권 확인
    const comment = await AppDataSource
      .getRepository(Comment)
      .findOne({
        where: { id: commentId, userId }
      });

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: '댓글을 찾을 수 없거나 삭제 권한이 없습니다.'
      });
    }

    // 댓글 삭제
    await AppDataSource.getRepository(Comment).remove(comment);

    res.json({
      success: true,
      message: '댓글이 삭제되었습니다.'
    });
  } catch (error) {
    console.error('댓글 삭제 에러:', error);
    res.status(500).json({
      success: false,
      error: '댓글 삭제 중 오류가 발생했습니다.'
    });
  }
});

export default router;
