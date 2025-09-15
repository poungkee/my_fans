import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToMany } from 'typeorm';
import { NewsArticle } from './NewsArticle';

@Entity('keywords')
export class Keyword {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  keyword: string; // 키워드

  @Column({ type: 'int', default: 1 })
  frequency: number; // 전체 빈도수

  // AI 분석 결과
  @Column({ type: 'int', nullable: true })
  sentiment_score?: number; // 감정 점수 (-100 ~ 100)

  @Column({ type: 'int', nullable: true })
  importance_score?: number; // 중요도 점수 (0-100)

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // 관계 설정
  @ManyToMany(() => NewsArticle, article => article.keywords)
  articles: NewsArticle[];
}