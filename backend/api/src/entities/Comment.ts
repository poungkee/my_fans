import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './User';
import { NewsArticle } from './NewsArticle';

@Entity('comments')
export class Comment {
    @PrimaryGeneratedColumn('increment', { type: 'bigint' })
    id: number;

    @Column({ type: 'text' })
    content: string;

    @Column({ type: 'bigint', name: 'user_id' })
    userId: number;

    @Column({ type: 'bigint', name: 'article_id' })
    articleId: number;

    @Column({ type: 'bigint', nullable: true, name: 'parent_id' })
    parentId?: number;

    @Column({ type: 'int', default: 0, name: 'like_count' })
    likeCount: number;

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
    updatedAt: Date;

    // 관계 설정
    @ManyToOne(() => User, (user) => user.comments)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @ManyToOne(() => NewsArticle, (article) => article.comments)
    @JoinColumn({ name: 'article_id' })
    article: NewsArticle;

    @ManyToOne(() => Comment, (comment) => comment.replies, { nullable: true })
    @JoinColumn({ name: 'parent_id' })
    parent?: Comment;

    @OneToMany(() => Comment, (comment) => comment.parent)
    replies: Comment[];
}