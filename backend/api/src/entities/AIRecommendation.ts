import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { User } from './User';
import { NewsArticle } from './NewsArticle';

@Entity('ai_recommendations')
@Unique(['userId', 'articleId'])
export class AIRecommendation {
    @PrimaryGeneratedColumn('increment', { type: 'bigint' })
    id: number;

    @Column({ type: 'bigint', name: 'user_id' })
    userId: number;

    @Column({ type: 'bigint', name: 'article_id' })
    articleId: number;

    @Column({ type: 'decimal', precision: 4, scale: 2, name: 'recommendation_score' })
    recommendationScore: number;

    @Column({ type: 'jsonb', nullable: true, name: 'recommendation_reason' })
    recommendationReason?: object;

    @Column({ type: 'varchar', length: 20, nullable: true, name: 'model_version' })
    modelVersion?: string;

    @Column({ type: 'boolean', default: false, name: 'was_clicked' })
    wasClicked: boolean;

    @Column({ type: 'boolean', default: false, name: 'was_read' })
    wasRead: boolean;

    @Column({ type: 'int', nullable: true, name: 'feedback_score' })
    feedbackScore?: number;

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt: Date;

    // 관계 설정
    @ManyToOne(() => User, (user) => user.recommendations)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @ManyToOne(() => NewsArticle, (article) => article.recommendations)
    @JoinColumn({ name: 'article_id' })
    article: NewsArticle;
}