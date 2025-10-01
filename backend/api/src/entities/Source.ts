import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { NewsArticle } from './NewsArticle';

@Entity('sources')
export class Source {
    @Column({ type: 'integer', primary: true })
    id!: number;

    @Column({ type: 'varchar', length: 100, unique: true })
    name!: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    logo_url?: string;

    // 관계 설정
    @OneToMany(() => NewsArticle, (article) => article.source)
    articles: NewsArticle[];
}