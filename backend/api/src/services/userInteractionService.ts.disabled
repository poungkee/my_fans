import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { UserNewsInteraction } from '../entities/UserNewsInteraction';
import { Comment } from '../entities/Comment';
import { NewsArticle } from '../entities/NewsArticle';

export class UserInteractionService {
  private userNewsInteractionRepository: Repository<UserNewsInteraction>;
  private commentRepository: Repository<Comment>;
  private newsArticleRepository: Repository<NewsArticle>;

  constructor() {
    this.userNewsInteractionRepository = AppDataSource.getRepository(UserNewsInteraction);
    this.commentRepository = AppDataSource.getRepository(Comment);
    this.newsArticleRepository = AppDataSource.getRepository(NewsArticle);
  }

  // 사용자의 북마크 목록 조회
  async getBookmarks(userId: number) {
    try {
      const interactions = await this.userNewsInteractionRepository
        .createQueryBuilder('interaction')
        .leftJoinAndSelect('interaction.newsArticle', 'news')
        .where('interaction.user_id = :userId', { userId })
        .andWhere('interaction.is_bookmarked = true')
        .orderBy('interaction.bookmarked_at', 'DESC')
        .getMany();

      return interactions.map(interaction => ({
        id: interaction.id,
        newsId: interaction.newsArticle?.id,
        title: interaction.newsArticle?.title,
        summary: interaction.newsArticle?.summary,
        mediaSource: interaction.newsArticle?.media_source,
        url: interaction.newsArticle?.url,
        pubDate: interaction.newsArticle?.pub_date,
        bookmarkedAt: interaction.bookmarked_at
      }));
    } catch (error) {
      console.error('북마크 조회 에러:', error);
      throw new Error('북마크 목록을 가져오는 중 오류가 발생했습니다.');
    }
  }

  // 사용자의 좋아요 목록 조회
  async getLikedNews(userId: number) {
    try {
      const interactions = await this.userNewsInteractionRepository
        .createQueryBuilder('interaction')
        .leftJoinAndSelect('interaction.newsArticle', 'news')
        .where('interaction.user_id = :userId', { userId })
        .andWhere('interaction.is_liked = true')
        .orderBy('interaction.liked_at', 'DESC')
        .getMany();

      return interactions.map(interaction => ({
        id: interaction.id,
        newsId: interaction.newsArticle?.id,
        title: interaction.newsArticle?.title,
        summary: interaction.newsArticle?.summary,
        mediaSource: interaction.newsArticle?.media_source,
        url: interaction.newsArticle?.url,
        pubDate: interaction.newsArticle?.pub_date,
        likedAt: interaction.liked_at
      }));
    } catch (error) {
      console.error('좋아요 조회 에러:', error);
      throw new Error('좋아요 목록을 가져오는 중 오류가 발생했습니다.');
    }
  }

  // 사용자의 댓글 목록 조회
  async getComments(userId: number) {
    try {
      const comments = await this.commentRepository
        .createQueryBuilder('comment')
        .leftJoinAndSelect('comment.newsArticle', 'news')
        .where('comment.user_id = :userId', { userId })
        .orderBy('comment.created_at', 'DESC')
        .getMany();

      return comments.map(comment => ({
        id: comment.id,
        content: comment.content,
        createdAt: comment.created_at,
        news: {
          id: comment.newsArticle?.id,
          title: comment.newsArticle?.title,
          mediaSource: comment.newsArticle?.media_source,
          pubDate: comment.newsArticle?.pub_date
        }
      }));
    } catch (error) {
      console.error('댓글 조회 에러:', error);
      throw new Error('댓글 목록을 가져오는 중 오류가 발생했습니다.');
    }
  }

  // 북마크 토글
  async toggleBookmark(userId: number, newsId: number) {
    try {
      // 뉴스 기사 존재 확인
      const newsArticle = await this.newsArticleRepository.findOne({
        where: { id: newsId }
      });

      if (!newsArticle) {
        throw new Error('뉴스 기사를 찾을 수 없습니다.');
      }

      // 기존 상호작용 확인
      let interaction = await this.userNewsInteractionRepository.findOne({
        where: { user_id: userId, news_article_id: newsId }
      });

      if (!interaction) {
        // 새 상호작용 생성
        interaction = this.userNewsInteractionRepository.create({
          user_id: userId,
          news_article_id: newsId,
          is_bookmarked: true,
          bookmarked_at: new Date()
        });
      } else {
        // 기존 상호작용 업데이트
        interaction.is_bookmarked = !interaction.is_bookmarked;
        interaction.bookmarked_at = interaction.is_bookmarked ? new Date() : null;
      }

      await this.userNewsInteractionRepository.save(interaction);

      return {
        isBookmarked: interaction.is_bookmarked,
        message: interaction.is_bookmarked ? '북마크에 추가되었습니다.' : '북마크에서 제거되었습니다.'
      };
    } catch (error) {
      console.error('북마크 토글 에러:', error);
      throw new Error('북마크 처리 중 오류가 발생했습니다.');
    }
  }

  // 좋아요 토글
  async toggleLike(userId: number, newsId: number) {
    try {
      // 뉴스 기사 존재 확인
      const newsArticle = await this.newsArticleRepository.findOne({
        where: { id: newsId }
      });

      if (!newsArticle) {
        throw new Error('뉴스 기사를 찾을 수 없습니다.');
      }

      // 기존 상호작용 확인
      let interaction = await this.userNewsInteractionRepository.findOne({
        where: { user_id: userId, news_article_id: newsId }
      });

      if (!interaction) {
        // 새 상호작용 생성
        interaction = this.userNewsInteractionRepository.create({
          user_id: userId,
          news_article_id: newsId,
          is_liked: true,
          liked_at: new Date()
        });
      } else {
        // 기존 상호작용 업데이트
        interaction.is_liked = !interaction.is_liked;
        interaction.liked_at = interaction.is_liked ? new Date() : null;
      }

      await this.userNewsInteractionRepository.save(interaction);

      return {
        isLiked: interaction.is_liked,
        message: interaction.is_liked ? '좋아요를 눌렀습니다.' : '좋아요를 취소했습니다.'
      };
    } catch (error) {
      console.error('좋아요 토글 에러:', error);
      throw new Error('좋아요 처리 중 오류가 발생했습니다.');
    }
  }

  // 댓글 작성
  async createComment(userId: number, newsId: number, content: string) {
    try {
      // 뉴스 기사 존재 확인
      const newsArticle = await this.newsArticleRepository.findOne({
        where: { id: newsId }
      });

      if (!newsArticle) {
        throw new Error('뉴스 기사를 찾을 수 없습니다.');
      }

      // 댓글 생성
      const comment = this.commentRepository.create({
        user_id: userId,
        news_article_id: newsId,
        content: content.trim()
      });

      const savedComment = await this.commentRepository.save(comment);

      return {
        id: savedComment.id,
        content: savedComment.content,
        createdAt: savedComment.created_at,
        message: '댓글이 작성되었습니다.'
      };
    } catch (error) {
      console.error('댓글 작성 에러:', error);
      throw new Error('댓글 작성 중 오류가 발생했습니다.');
    }
  }

  // 댓글 삭제
  async deleteComment(userId: number, commentId: number) {
    try {
      const comment = await this.commentRepository.findOne({
        where: { id: commentId, user_id: userId }
      });

      if (!comment) {
        throw new Error('댓글을 찾을 수 없거나 삭제 권한이 없습니다.');
      }

      await this.commentRepository.remove(comment);

      return {
        message: '댓글이 삭제되었습니다.'
      };
    } catch (error) {
      console.error('댓글 삭제 에러:', error);
      throw new Error('댓글 삭제 중 오류가 발생했습니다.');
    }
  }
}

