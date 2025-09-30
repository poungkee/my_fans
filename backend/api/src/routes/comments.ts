import { Router, Request, Response } from "express";
import { AppDataSource } from "../config/database";
import { Comment } from "../entities/Comment";
import { User } from "../entities/User";
import { NewsArticle } from "../entities/NewsArticle";
import { authenticateToken, AuthenticatedRequest } from "../middleware/authMiddleware";
import logger from "../config/logger";

const router = Router();

// 특정 기사의 댓글 목록 조회
router.get("/comments/article/:articleId", async (req: Request, res: Response) => {
  try {
    const { articleId } = req.params;
    const commentRepo = AppDataSource.getRepository(Comment);

    const comments = await commentRepo.createQueryBuilder("comment")
      .leftJoinAndSelect("comment.user", "user")
      .leftJoinAndSelect("comment.replies", "replies")
      .leftJoinAndSelect("replies.user", "replyUser")
      .where("comment.articleId = :articleId", { articleId })
      .andWhere("comment.parentId IS NULL") // 최상위 댓글만
      .orderBy("comment.createdAt", "DESC")
      .addOrderBy("replies.createdAt", "ASC")
      .getMany();

    const formattedComments = comments.map(comment => ({
      id: comment.id,
      content: comment.content,
      author: comment.user.username,
      timestamp: comment.createdAt.toLocaleString('ko-KR'),
      likes: comment.likeCount,
      isLiked: false, // TODO: 사용자별 좋아요 상태 확인
      replies: comment.replies?.map(reply => ({
        id: reply.id,
        content: reply.content,
        author: reply.user.username,
        timestamp: reply.createdAt.toLocaleString('ko-KR'),
        likes: reply.likeCount,
        isLiked: false // TODO: 사용자별 좋아요 상태 확인
      })) || []
    }));

    res.json({ success: true, data: formattedComments });
  } catch (error) {
    logger.error("댓글 조회 실패:", error);
    res.status(500).json({ error: "댓글 조회에 실패했습니다." });
  }
});

// 댓글 작성 (로그인 필요)
router.post("/comments", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { articleId, content, parentId } = req.body;
    const userId = req.user!.userId;

    const commentRepo = AppDataSource.getRepository(Comment);
    const userRepo = AppDataSource.getRepository(User);
    const articleRepo = AppDataSource.getRepository(NewsArticle);

    // 사용자 확인
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    }

    // 기사 확인
    const article = await articleRepo.findOne({ where: { id: parseInt(articleId) } });
    if (!article) {
      return res.status(404).json({ error: "기사를 찾을 수 없습니다." });
    }

    // 부모 댓글 확인 (답글인 경우)
    if (parentId) {
      const parentComment = await commentRepo.findOne({ where: { id: parseInt(parentId) } });
      if (!parentComment) {
        return res.status(404).json({ error: "부모 댓글을 찾을 수 없습니다." });
      }
    }

    // 댓글 생성
    const newComment = commentRepo.create({
      content,
      userId: parseInt(userId.toString()),
      articleId: parseInt(articleId),
      parentId: parentId ? parseInt(parentId) : undefined
    });

    const savedComment = await commentRepo.save(newComment);

    // 사용자 정보와 함께 반환
    const commentWithUser = await commentRepo.findOne({
      where: { id: savedComment.id },
      relations: ['user']
    });

    const formattedComment = {
      id: commentWithUser!.id,
      content: commentWithUser!.content,
      author: commentWithUser!.user.username,
      timestamp: commentWithUser!.createdAt.toLocaleString('ko-KR'),
      likes: commentWithUser!.likeCount,
      isLiked: false,
      replies: []
    };

    res.status(201).json({ success: true, data: formattedComment });
  } catch (error) {
    logger.error("댓글 작성 실패:", error);
    res.status(500).json({ error: "댓글 작성에 실패했습니다." });
  }
});

// 댓글 삭제 (로그인 필요)
router.delete("/comments/:commentId", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = req.user!.userId;

    const commentRepo = AppDataSource.getRepository(Comment);

    const comment = await commentRepo.findOne({
      where: { id: parseInt(commentId) },
      relations: ['user']
    });

    if (!comment) {
      return res.status(404).json({ error: "댓글을 찾을 수 없습니다." });
    }

    // 작성자 확인
    if (comment.userId !== userId) {
      return res.status(403).json({ error: "댓글 삭제 권한이 없습니다." });
    }

    await commentRepo.remove(comment);

    res.json({ success: true, message: "댓글이 삭제되었습니다." });
  } catch (error) {
    logger.error("댓글 삭제 실패:", error);
    res.status(500).json({ error: "댓글 삭제에 실패했습니다." });
  }
});

// 댓글 좋아요/좋아요 취소 (로그인 필요)
router.post("/comments/:commentId/like", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { commentId } = req.params;
    const { action } = req.body; // 'add' or 'remove'

    const commentRepo = AppDataSource.getRepository(Comment);

    const comment = await commentRepo.findOne({ where: { id: parseInt(commentId) } });
    if (!comment) {
      return res.status(404).json({ error: "댓글을 찾을 수 없습니다." });
    }

    if (action === 'add') {
      comment.likeCount += 1;
    } else if (action === 'remove') {
      comment.likeCount = Math.max(0, comment.likeCount - 1);
    }

    await commentRepo.save(comment);

    res.json({
      success: true,
      data: {
        likeCount: comment.likeCount,
        isLiked: action === 'add'
      }
    });
  } catch (error) {
    logger.error("댓글 좋아요 처리 실패:", error);
    res.status(500).json({ error: "좋아요 처리에 실패했습니다." });
  }
});

export default router;