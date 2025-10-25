import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Source } from './Source';
import { Category } from './Category';

@Entity('news_articles')
export class NewsArticle {
    @PrimaryGeneratedColumn('increment', { type: 'bigint' })
    id!: number;

    @Column({ type: 'varchar', length: 500 })
    title!: string;

    @Column({ type: 'text', nullable: true })
    content?: string;

    @Column({ type: 'text', nullable: true, name: 'ai_summary' })
    aiSummary?: string;

    @Column({ type: 'varchar', length: 1000, nullable: true, unique: true })
    url?: string;

    @Column({ type: 'varchar', length: 1000, nullable: true, name: 'image_url' })
    imageUrl?: string;

    @Column({ type: 'integer', name: 'source_id' })
    sourceId!: number;

    @Column({ type: 'bigint', name: 'category_id' })
    categoryId!: number;

    @Column({ type: 'varchar', length: 100, nullable: true })
    journalist?: string;

    @Column({ type: 'timestamptz', name: 'pub_date', nullable: true })
    pubDate?: Date;

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
    updatedAt!: Date;

    // 관계 설정 (크롤러에서는 최소한으로)
    @ManyToOne(() => Source)
    @JoinColumn({ name: 'source_id' })
    source?: Source;

    @ManyToOne(() => Category)
    @JoinColumn({ name: 'category_id' })
    category?: Category;
}