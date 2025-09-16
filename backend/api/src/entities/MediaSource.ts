import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { NewsArticle } from './NewsArticle';
import { Journalist } from './Journalist';

@Entity('media_sources')
export class MediaSource {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string; // 언론사명 (ex: '조선일보', 'KBS')

  @Column({ type: 'varchar', length: 200, unique: true })
  domain: string; // 도메인 (ex: 'chosun.com')

  @Column({ type: 'varchar', length: 500, nullable: true })
  logo_url?: string; // 로고 이미지

  // AI 분석 결과
  @Column({ type: 'varchar', length: 20, nullable: true })
  political_bias?: string; // 정치적 성향 ('left', 'center', 'right')

  @Column({ type: 'int', nullable: true })
  credibility_score?: number; // 신뢰도 점수 (0-100)

  // 메타정보
  @Column({ type: 'int', nullable: true })
  founded_year?: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  headquarters?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // 관계 설정
  @OneToMany(() => NewsArticle, article => article.media_source)
  articles: NewsArticle[];

  @OneToMany(() => Journalist, journalist => journalist.media_source)
  journalists: Journalist[];
}