import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { NewsArticle } from './NewsArticle';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  name: string; // 카테고리명 ('정치', '경제', '기술', ...)

  @Column({ type: 'varchar', length: 50, unique: true })
  slug: string; // URL용 슬러그 ('politics', 'economy', ...)

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color_code?: string; // UI 색상 코드 (#FFFFFF)

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon?: string; // 아이콘

  @Column({ type: 'int', nullable: true })
  parent_id?: number; // 상위 카테고리 (계층 구조)

  @Column({ type: 'int', default: 0 })
  sort_order: number; // 정렬 순서

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // 관계 설정
  @ManyToOne(() => Category, category => category.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: Category;

  @OneToMany(() => Category, category => category.parent)
  children: Category[];

  @OneToMany(() => NewsArticle, article => article.category)
  articles: NewsArticle[];
}