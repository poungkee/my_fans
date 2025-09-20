import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { NewsKeyword } from './NewsKeyword';

@Entity('keywords')
export class Keyword {
    @PrimaryGeneratedColumn('increment', { type: 'bigint' })
    id: number;

    @Column({ type: 'varchar', length: 100, unique: true })
    keyword: string;

    @Column({ type: 'int', default: 1 })
    frequency: number;

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt: Date;

    // 관계 설정
    @OneToMany(() => NewsKeyword, (newsKeyword) => newsKeyword.keyword)
    newsKeywords: NewsKeyword[];
}