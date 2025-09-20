import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { NewsArticle } from './NewsArticle';
import { Keyword } from './Keyword';

@Entity('news_keywords')
export class NewsKeyword {
    @PrimaryColumn({ type: 'bigint', name: 'news_id' })
    newsId: number;

    @PrimaryColumn({ type: 'bigint', name: 'keyword_id' })
    keywordId: number;

    @Column({ type: 'double precision', default: 1.0 })
    relevance: number;

    // 관계 설정
    @ManyToOne(() => NewsArticle, (article) => article.newsKeywords)
    @JoinColumn({ name: 'news_id' })
    article: NewsArticle;

    @ManyToOne(() => Keyword, (keyword) => keyword.newsKeywords)
    @JoinColumn({ name: 'keyword_id' })
    keyword: Keyword;
}