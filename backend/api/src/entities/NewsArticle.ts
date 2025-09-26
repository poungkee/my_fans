import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Source } from './Source';
import { Category } from './Category';
import { NewsKeyword } from './NewsKeyword';
import { UserAction } from './UserAction';
import { Bookmark } from './Bookmark';
import { AIRecommendation } from './AIRecommendation';
import { BiasAnalysis } from './BiasAnalysis';
import { ArticleStat } from './ArticleStat';
import { Comment } from './Comment';

@Entity('news_articles')
export class NewsArticle {
    @PrimaryGeneratedColumn('increment', { type: 'bigint' })
    id: number;

    @Column({ type: 'varchar', length: 500 })
    title: string;

    @Column({ type: 'text', nullable: true })
    content?: string;

    @Column({ type: 'text', nullable: true, name: 'ai_summary' })
    aiSummary?: string;

    @Column({ type: 'varchar', length: 1000, nullable: true, unique: true })
    url?: string;

    @Column({ type: 'varchar', length: 1000, nullable: true, name: 'image_url' })
    imageUrl?: string;

    @Column({ type: 'bigint', name: 'source_id' })
    sourceId: number;

    @Column({ type: 'bigint', name: 'category_id' })
    categoryId: number;

    @Column({ type: 'varchar', length: 100, nullable: true })
    journalist?: string;

    @Column({ type: 'timestamptz', nullable: true, name: 'pub_date' })
    pubDate?: Date;

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
    updatedAt: Date;

    @Column({ type: 'tsvector', nullable: true, name: 'search_vector' })
    searchVector?: string;

    // 관계 설정
    @ManyToOne(() => Source, (source) => source.articles)
    @JoinColumn({ name: 'source_id' })
    source: Source;

    @ManyToOne(() => Category, (category) => category.articles)
    @JoinColumn({ name: 'category_id' })
    category: Category;

    @OneToMany(() => NewsKeyword, (newsKeyword) => newsKeyword.article)
    newsKeywords: NewsKeyword[];

    @OneToMany(() => UserAction, (userAction) => userAction.article)
    userActions: UserAction[];

    @OneToMany(() => Bookmark, (bookmark) => bookmark.article)
    bookmarks: Bookmark[];

    @OneToMany(() => AIRecommendation, (recommendation) => recommendation.article)
    recommendations: AIRecommendation[];

    @OneToMany(() => BiasAnalysis, (bias) => bias.article)
    biasAnalyses: BiasAnalysis[];

    @OneToMany(() => ArticleStat, (stat) => stat.article)
    stats: ArticleStat[];

    @OneToMany(() => Comment, (comment) => comment.article)
    comments: Comment[];
}