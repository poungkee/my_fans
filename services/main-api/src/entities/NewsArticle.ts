import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, ManyToMany, JoinColumn, JoinTable } from 'typeorm';
import { MediaSource } from './MediaSource';
import { Journalist } from './Journalist';
import { Category } from './Category';
import { Keyword } from './Keyword';
import { UserNewsInteraction } from './UserNewsInteraction';
import { Comment } from './Comment';

@Entity('news_articles')
export class NewsArticle {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'text', nullable: true })
  content?: string;

  @Column({ type: 'text', nullable: true })
  summary?: string; // 원본 요약

  @Column({ type: 'text', nullable: true })
  ai_summary?: string; // AI 생성 요약

  @Column({ type: 'varchar', length: 50, nullable: true })
  short_ai_summary?: string; // 짧은 AI 요약 (40자)

  // URL 정보
  @Column({ type: 'varchar', length: 1000, unique: true })
  url: string; // 네이버 뉴스 URL

  @Column({ type: 'varchar', length: 1000, nullable: true })
  origin_url?: string; // 원본 기사 URL

  @Column({ type: 'varchar', length: 1000, nullable: true })
  image_url?: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  video_url?: string;

  // 분류 정보 (FK)
  @Column({ type: 'int', nullable: true })
  media_source_id?: number; // 언론사 ID

  @Column({ type: 'int', nullable: true })
  journalist_id?: number; // 기자 ID

  @Column({ type: 'int', nullable: true })
  category_id?: number; // 카테고리 ID

  // 날짜
  @Column({ type: 'timestamptz' })
  pub_date: Date; // 발행일

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date; // 수집일

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date; // 수정일

  // 통계 (캐시용)
  @Column({ type: 'int', default: 0 })
  view_count: number;

  @Column({ type: 'int', default: 0 })
  like_count: number;

  @Column({ type: 'int', default: 0 })
  dislike_count: number;

  @Column({ type: 'int', default: 0 })
  scrap_count: number;

  @Column({ type: 'int', default: 0 })
  comment_count: number; // 댓글 수

  // 관계 설정
  @ManyToOne(() => MediaSource, media => media.articles, { nullable: true })
  @JoinColumn({ name: 'media_source_id' })
  media_source?: MediaSource;

  @ManyToOne(() => Journalist, journalist => journalist.articles, { nullable: true })
  @JoinColumn({ name: 'journalist_id' })
  journalist?: Journalist;

  @ManyToOne(() => Category, category => category.articles, { nullable: true })
  @JoinColumn({ name: 'category_id' })
  category?: Category;

  @ManyToMany(() => Keyword, keyword => keyword.articles)
  @JoinTable({
    name: 'news_keywords',
    joinColumn: { name: 'news_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'keyword_id', referencedColumnName: 'id' }
  })
  keywords: Keyword[];

  @OneToMany(() => UserNewsInteraction, interaction => interaction.news_article)
  interactions: UserNewsInteraction[];

  @OneToMany(() => Comment, comment => comment.news_article)
  comments: Comment[];
}