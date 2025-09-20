import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { NewsArticle } from './NewsArticle';
import { Source } from './Source';

@Entity('bias_analysis')
@Unique(['articleId'])
export class BiasAnalysis {
    @PrimaryGeneratedColumn('increment', { type: 'bigint' })
    id: number;

    @Column({ type: 'bigint', name: 'article_id' })
    articleId: number;

    @Column({ type: 'bigint', nullable: true, name: 'source_id' })
    sourceId?: number;

    @Column({ type: 'varchar', length: 100, nullable: true })
    journalist?: string;

    @Column({ type: 'decimal', precision: 3, scale: 1, nullable: true, name: 'political_bias' })
    politicalBias?: number;

    @Column({ type: 'decimal', precision: 3, scale: 1, nullable: true, name: 'economic_bias' })
    economicBias?: number;

    @Column({ type: 'decimal', precision: 3, scale: 1, nullable: true, name: 'social_bias' })
    socialBias?: number;

    @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true, name: 'confidence_level' })
    confidenceLevel?: number;

    @Column({ type: 'varchar', length: 50, nullable: true, name: 'analysis_method' })
    analysisMethod?: string;

    @Column({ type: 'int', nullable: true, name: 'sample_size' })
    sampleSize?: number;

    @Column({ type: 'jsonb', nullable: true, name: 'analysis_data' })
    analysisData?: object;

    @CreateDateColumn({ type: 'timestamptz', name: 'analyzed_at' })
    analyzedAt: Date;

    // 관계 설정
    @ManyToOne(() => NewsArticle, (article) => article.biasAnalyses)
    @JoinColumn({ name: 'article_id' })
    article: NewsArticle;

    @ManyToOne(() => Source, (source) => source.biasAnalyses)
    @JoinColumn({ name: 'source_id' })
    source?: Source;
}