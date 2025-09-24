import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { NewsArticle } from './NewsArticle';

@Entity('categories')
export class Category {
    @PrimaryGeneratedColumn('increment', { type: 'bigint' })
    id!: number;

    @Column({ type: 'varchar', length: 50, unique: true })
    name!: string;

    // 관계 설정 (크롤러에서는 최소한으로)
    @OneToMany(() => NewsArticle, (article) => article.category)
    articles?: NewsArticle[];
}