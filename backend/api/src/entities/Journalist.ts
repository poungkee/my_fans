import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { MediaSource } from './MediaSource';
import { NewsArticle } from './NewsArticle';

@Entity('journalists')
export class Journalist {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email?: string;

  // 소속 정보
  @Column({ type: 'int' })
  media_source_id: number; // 언론사 ID (FK)

  @Column({ type: 'varchar', length: 50, nullable: true })
  department?: string; // 부서 (ex: '정치부', '경제부')

  @Column({ type: 'varchar', length: 50, nullable: true })
  position?: string; // 직책 (ex: '기자', '편집장')

  // AI 분석 결과
  @Column({ type: 'json', nullable: true })
  expertise_areas?: string[]; // 전문 분야 (['정치', '경제'])

  @Column({ type: 'int', nullable: true })
  writing_style_score?: number; // 문체 점수

  @Column({ type: 'int', nullable: true })
  objectivity_score?: number; // 객관성 점수 (0-100)

  @Column({ type: 'varchar', length: 50, nullable: true })
  political_inclination?: string; // 정치 성향

  @Column({ type: 'int', nullable: true })
  credibility_score?: number; // 개인 신뢰도 점수

  // 통계
  @Column({ type: 'int', default: 0 })
  article_count: number;

  @Column({ type: 'float', nullable: true })
  avg_article_rating?: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // 관계 설정
  @ManyToOne(() => MediaSource, media => media.journalists)
  @JoinColumn({ name: 'media_source_id' })
  media_source: MediaSource;

  @OneToMany(() => NewsArticle, article => article.journalist)
  articles: NewsArticle[];
}