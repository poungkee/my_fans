import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { UserNewsInteraction } from './UserNewsInteraction';
import { UserPreference } from './UserPreference';
import { Comment } from './Comment';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  username: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password_hash: string;

  // 개인정보 (추천 알고리즘용)
  @Column({ type: 'int', nullable: true })
  age?: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  gender?: string; // 'male', 'female', 'other'

  @Column({ type: 'varchar', length: 100, nullable: true })
  location?: string; // 지역 (ex: '서울시 강남구')

  @Column({ type: 'varchar', length: 100, nullable: true })
  occupation?: string; // 직업

  // 종합적인 성향 분석 (AI 기반)
  @Column({ type: 'varchar', length: 50, nullable: true })
  political_inclination?: string; // 정치 성향 ('progressive', 'conservative', 'moderate')

  @Column({ type: 'varchar', length: 50, nullable: true })
  social_inclination?: string; // 사회 성향 ('liberal', 'traditional', 'moderate')

  @Column({ type: 'varchar', length: 50, nullable: true })
  economic_inclination?: string; // 경제 성향 ('capitalist', 'socialist', 'mixed')

  @Column({ type: 'varchar', length: 50, nullable: true })
  cultural_inclination?: string; // 문화 성향 ('open', 'conservative', 'balanced')

  // 뉴스 선호도
  @Column({ type: 'json', nullable: true })
  preferred_categories?: string[]; // ['정치', '경제', '기술', ...]

  @Column({ type: 'json', nullable: true })
  preferred_media_sources?: string[]; // 선호 언론사

  @Column({ type: 'time', nullable: true })
  preferred_reading_time?: string; // 주로 뉴스 읽는 시간대

  // 계정 상태
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'boolean', default: false })
  is_verified: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  last_login?: Date;

  // 관계 설정
  @OneToMany(() => UserNewsInteraction, interaction => interaction.user)
  news_interactions: UserNewsInteraction[];

  @OneToMany(() => UserPreference, preference => preference.user)
  preferences: UserPreference[];

  @OneToMany(() => Comment, comment => comment.user)
  comments: Comment[];
}