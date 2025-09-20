import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { NewsArticle } from './NewsArticle';
import { BiasAnalysis } from './BiasAnalysis';

@Entity('sources')
export class Source {
    @PrimaryGeneratedColumn('increment', { type: 'bigint' })
    id: number;

    @Column({ type: 'varchar', length: 100, unique: true })
    name: string;

    // 관계 설정
    @OneToMany(() => NewsArticle, (article) => article.source)
    articles: NewsArticle[];

    @OneToMany(() => BiasAnalysis, (bias) => bias.source)
    biasAnalyses: BiasAnalysis[];
}