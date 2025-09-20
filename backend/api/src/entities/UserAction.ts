import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { User } from './User';
import { NewsArticle } from './NewsArticle';

export enum ActionType {
    VIEW = 'VIEW',
    LIKE = 'LIKE',
    DISLIKE = 'DISLIKE',
    BOOKMARK = 'BOOKMARK'
}

@Entity('user_actions')
@Unique(['userId', 'articleId', 'actionType'])
export class UserAction {
    @PrimaryGeneratedColumn('increment', { type: 'bigint' })
    id: number;

    @Column({ type: 'bigint', name: 'user_id' })
    userId: number;

    @Column({ type: 'bigint', name: 'article_id' })
    articleId: number;

    @Column({ type: 'varchar', length: 20, name: 'action_type' })
    actionType: ActionType;

    @Column({ type: 'int', nullable: true, name: 'reading_duration' })
    readingDuration?: number;

    @Column({ type: 'int', nullable: true, name: 'reading_percentage' })
    readingPercentage?: number;

    @Column({ type: 'double precision', default: 1.0 })
    weight: number;

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt: Date;

    // 관계 설정
    @ManyToOne(() => User, (user) => user.userActions)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @ManyToOne(() => NewsArticle, (article) => article.userActions)
    @JoinColumn({ name: 'article_id' })
    article: NewsArticle;
}