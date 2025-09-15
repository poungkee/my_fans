import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';
import { NewsArticle } from './NewsArticle';

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'bigint' })
  news_id: number; // 뉴스 ID (FK)

  @Column({ type: 'int' })
  user_id: number; // 사용자 ID (FK)

  // 댓글 내용
  @Column({ type: 'text' })
  content: string; // 댓글 내용

  @Column({ type: 'boolean', default: false })
  is_deleted: boolean; // 삭제 여부 (소프트 삭제)

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // 관계 설정
  @ManyToOne(() => User, user => user.comments)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => NewsArticle, article => article.comments)
  @JoinColumn({ name: 'news_id' })
  news_article: NewsArticle;
}