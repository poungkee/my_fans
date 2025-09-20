import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { User } from './User';
import { NewsArticle } from './NewsArticle';

@Entity('bookmarks')
@Unique(['userId', 'newsId'])
export class Bookmark {
    @PrimaryGeneratedColumn('increment', { type: 'bigint' })
    id: number;

    @Column({ type: 'bigint', name: 'user_id' })
    userId: number;

    @Column({ type: 'bigint', name: 'news_id' })
    newsId: number;

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt: Date;

    // 관계 설정
    @ManyToOne(() => User, (user) => user.bookmarks)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @ManyToOne(() => NewsArticle, (article) => article.bookmarks)
    @JoinColumn({ name: 'news_id' })
    article: NewsArticle;
}