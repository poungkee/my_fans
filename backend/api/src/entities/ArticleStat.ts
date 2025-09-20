import { Entity, PrimaryColumn, Column, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { NewsArticle } from './NewsArticle';

@Entity('article_stats')
export class ArticleStat {
    @PrimaryColumn({ type: 'bigint', name: 'article_id' })
    articleId: number;

    @Column({ type: 'bigint', default: 0, name: 'view_count' })
    viewCount: number;

    @Column({ type: 'bigint', default: 0, name: 'like_count' })
    likeCount: number;

    @Column({ type: 'bigint', default: 0, name: 'dislike_count' })
    dislikeCount: number;

    @Column({ type: 'bigint', default: 0, name: 'bookmark_count' })
    bookmarkCount: number;

    @Column({ type: 'bigint', default: 0, name: 'comment_count' })
    commentCount: number;

    @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
    updatedAt: Date;

    // 관계 설정
    @OneToOne(() => NewsArticle, (article) => article.stats)
    @JoinColumn({ name: 'article_id' })
    article: NewsArticle;
}