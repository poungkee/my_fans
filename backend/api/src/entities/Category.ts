import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { NewsArticle } from './NewsArticle';

@Entity('categories')
export class Category {
    @PrimaryGeneratedColumn('increment', { type: 'bigint' })
    id: number;

    @Column({ type: 'varchar', length: 50, unique: true })
    name: string;

    // 관계 설정
    @OneToMany(() => NewsArticle, (article) => article.category)
    articles: NewsArticle[];
}