import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('bias_analysis')
export class BiasAnalysis {
    @PrimaryGeneratedColumn('increment', { type: 'bigint' })
    id!: number;

    @Column({ type: 'bigint', name: 'article_id' })
    articleId!: number;

    @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true, name: 'bias_score' })
    biasScore?: number;

    @Column({ type: 'varchar', length: 50, nullable: true, name: 'political_leaning' })
    politicalLeaning?: string;

    @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
    confidence?: number;

    @Column({ type: 'jsonb', nullable: true, name: 'analysis_data' })
    analysisData?: object;

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
    updatedAt!: Date;
}