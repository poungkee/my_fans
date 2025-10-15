import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('raw_news_articles')
export class RawNewsArticle {
    @PrimaryGeneratedColumn('increment', { type: 'bigint' })
    id!: number;

    @Column({ type: 'varchar', length: 500 })
    title!: string;

    @Column({ type: 'text', nullable: true })
    content?: string;

    @Column({ type: 'varchar', length: 1000, nullable: true, unique: true })
    url?: string;

    @Column({ type: 'varchar', length: 1000, nullable: true, name: 'image_url' })
    imageUrl?: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    journalist?: string;

    @Column({ type: 'timestamptz', name: 'pub_date', nullable: true })
    pubDate?: Date;

    // 원본 데이터 (텍스트 형태로 저장)
    @Column({ type: 'varchar', length: 200, nullable: true, name: 'original_source' })
    originalSource?: string;

    @Column({ type: 'varchar', length: 100, nullable: true, name: 'original_category' })
    originalCategory?: string;

    // 처리 상태
    @Column({ type: 'boolean', default: false })
    processed!: boolean;

    @Column({ type: 'timestamptz', nullable: true, name: 'processed_at' })
    processedAt?: Date;

    @Column({ type: 'text', nullable: true, name: 'processing_error' })
    processingError?: string;

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
    updatedAt!: Date;
}
