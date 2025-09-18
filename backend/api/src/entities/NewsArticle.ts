import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable, ManyToOne, JoinColumn } from 'typeorm';
import { Keyword } from './Keyword';

@Entity('news_articles')
export class NewsArticle {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  // 기본 정보
  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'text', nullable: true })
  content?: string;

  @Column({ type: 'text', nullable: true })
  summary?: string; // 네이버 원본 요약

  @Column({ type: 'text', nullable: true })
  ai_summary?: string; // AI 생성 요약

  @Column({ type: 'varchar', length: 100, nullable: true })
  short_ai_summary?: string; // 짧은 AI 요약

  // URL 정보
  @Column({ type: 'varchar', length: 1000, nullable: true, unique: true })
  url?: string; // 네이버 뉴스 URL

  @Column({ type: 'varchar', length: 1000, nullable: true })
  origin_url?: string; // 원본 기사 URL

  // 미디어 (URL만 저장)
  @Column({ type: 'varchar', length: 1000, nullable: true })
  image_url?: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  video_url?: string;

  // 관계형 참조 (새 스키마)
  @Column({ type: 'integer' })
  media_source_id: number;

  @Column({ type: 'integer', nullable: true })
  journalist_id?: number;

  @Column({ type: 'integer' })
  category_id: number;

  // 추가 통계 필드
  @Column({ type: 'integer', default: 0 })
  view_count: number;

  @Column({ type: 'integer', default: 0 })
  like_count: number;

  @Column({ type: 'integer', default: 0 })
  dislike_count: number;

  @Column({ type: 'integer', default: 0 })
  scrap_count: number;

  @Column({ type: 'integer', default: 0 })
  comment_count: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  importance_score?: number;

  // 날짜
  @Column({ type: 'timestamptz', nullable: true })
  pub_date?: Date; // 발행일

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // 키워드 관계 (다대다)
  @ManyToMany(() => Keyword, keyword => keyword.articles)
  @JoinTable({
    name: 'news_keywords',
    joinColumn: { name: 'news_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'keyword_id', referencedColumnName: 'id' }
  })
  keywords?: Keyword[];
}