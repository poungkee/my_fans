import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';
import { NewsArticle } from './NewsArticle';

@Entity('user_news_interactions')
export class UserNewsInteraction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  user_id: number; // 사용자 ID (FK)

  @Column({ type: 'bigint' })
  news_id: number; // 뉴스 ID (FK)

  // 상호작용 타입
  @Column({ type: 'varchar', length: 20 })
  interaction_type: string; // 'view', 'like', 'dislike', 'scrap'

  // 추가 정보
  @Column({ type: 'int', nullable: true })
  reading_duration?: number; // 읽은 시간 (초)

  @Column({ type: 'int', nullable: true })
  reading_percentage?: number; // 읽은 비율 (0-100)

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // 관계 설정
  @ManyToOne(() => User, user => user.news_interactions)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => NewsArticle, article => article.interactions)
  @JoinColumn({ name: 'news_id' })
  news_article: NewsArticle;
}