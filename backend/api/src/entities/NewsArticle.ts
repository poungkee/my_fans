import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable } from 'typeorm';
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

  @Column({ type: 'varchar', length: 50, nullable: true })
  short_ai_summary?: string; // 짧은 AI 요약 (20-30자)

  // URL 정보
  @Column({ type: 'varchar', length: 1000, nullable: true })
  url?: string; // 네이버 뉴스 URL

  @Column({ type: 'varchar', length: 1000, nullable: true })
  origin_url?: string; // 원본 기사 URL

  // 미디어 (URL만 저장)
  @Column({ type: 'varchar', length: 1000, nullable: true })
  image_url?: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  video_url?: string;

  // 메타데이터 (단순화된 문자열)
  @Column({ type: 'varchar', length: 100, nullable: true })
  source?: string; // 언론사

  @Column({ type: 'varchar', length: 50, nullable: true })
  category?: string; // 카테고리

  // 날짜
  @Column({ type: 'timestamptz', nullable: true })
  pub_date?: Date; // 발행일

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // 전문검색용 (PostgreSQL tsvector)
  @Column({ type: 'tsvector', nullable: true })
  search_vector?: string;

  // 키워드 관계 (다대다)
  @ManyToMany(() => Keyword, keyword => keyword.articles)
  @JoinTable({
    name: 'news_keywords',
    joinColumn: { name: 'news_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'keyword_id', referencedColumnName: 'id' }
  })
  keywords?: Keyword[];
}