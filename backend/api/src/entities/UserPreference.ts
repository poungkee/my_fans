import { Entity, PrimaryColumn, Column, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { User } from './User';

export enum Gender {
    MALE = 'male',
    FEMALE = 'female',
    OTHER = 'other',
    UNKNOWN = 'unknown'
}

@Entity('user_preferences')
export class UserPreference {
    @PrimaryColumn({ type: 'bigint', name: 'user_id' })
    userId: number;

    @Column({ type: 'jsonb', nullable: true, name: 'preferred_categories' })
    preferredCategories?: object;

    @Column({ type: 'jsonb', nullable: true, name: 'preferred_keywords' })
    preferredKeywords?: object;

    @Column({ type: 'jsonb', nullable: true, name: 'preferred_sources' })
    preferredSources?: object;

    @Column({ type: 'int', nullable: true })
    age?: number;

    @Column({ type: 'varchar', length: 10, nullable: true })
    gender?: Gender;

    @Column({ type: 'varchar', length: 100, nullable: true })
    location?: string;

    @Column({ type: 'int', nullable: true, name: 'avg_reading_time' })
    avgReadingTime?: number;

    @Column({ type: 'jsonb', nullable: true, name: 'preferred_time_slots' })
    preferredTimeSlots?: object;

    @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
    updatedAt: Date;

    // 관계 설정
    @OneToOne(() => User, (user) => user.preference)
    @JoinColumn({ name: 'user_id' })
    user: User;
}