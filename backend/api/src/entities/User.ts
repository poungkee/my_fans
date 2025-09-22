import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, OneToOne } from 'typeorm';
import { UserAction } from './UserAction';
import { Bookmark } from './Bookmark';
import { AIRecommendation } from './AIRecommendation';
import { UserPreference } from './UserPreference';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('increment', { type: 'bigint' })
    id: number;

    @Column({ type: 'varchar', length: 50, unique: true })
    username: string;

    @Column({ type: 'varchar', length: 100, unique: true })
    email: string;

    @Column({ type: 'varchar', length: 255, name: 'password_hash' })
    passwordHash: string;

    @Column({ type: 'varchar', length: 100, nullable: true, name: 'user_name' })
    userName?: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    name?: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    tel?: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    phone?: string;

    @Column({ type: 'boolean', default: false, name: 'email_verified' })
    emailVerified: boolean;

    @Column({ type: 'varchar', length: 500, nullable: true, name: 'profile_image' })
    profileImage?: string;

    @Column({ type: 'boolean', default: true })
    active: boolean;

    @Column({ type: 'varchar', length: 20, default: 'local' })
    provider: string;

    @Column({ type: 'varchar', length: 500, nullable: true, name: 'social_token' })
    socialToken?: string;

    @Column({ type: 'varchar', length: 255, nullable: true, name: 'previous_pw' })
    previousPw?: string;

    @Column({ type: 'timestamptz', nullable: true, name: 'last_login' })
    lastLogin?: Date;

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
    updatedAt: Date;

    // 관계 설정
    @OneToMany(() => UserAction, (userAction) => userAction.user)
    userActions: UserAction[];

    @OneToMany(() => Bookmark, (bookmark) => bookmark.user)
    bookmarks: Bookmark[];

    @OneToMany(() => AIRecommendation, (recommendation) => recommendation.user)
    recommendations: AIRecommendation[];

    @OneToOne(() => UserPreference, (preference) => preference.user)
    preference: UserPreference;
}