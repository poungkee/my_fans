import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { UserNewsInteraction } from './UserNewsInteraction';
import { Comment } from './Comment';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  username?: string;

  // 소셜 로그인 정보
  @Column({ type: 'varchar', length: 20, nullable: true })
  provider?: string; // 'google', 'kakao', 'naver', 'local'

  @Column({ type: 'varchar', length: 255, nullable: true })
  provider_id?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password_hash?: string; // 일반 로그인용

  @Column({ type: 'varchar', length: 500, nullable: true })
  profile_image?: string;

  // 사용자 기본 정보
  @Column({ type: 'int', nullable: true })
  age?: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  gender?: string; // '남성', '여성', '기타'

  @Column({ type: 'varchar', length: 50, nullable: true })
  location?: string; // 지역

  // 선호 설정
  @Column({ type: 'json', nullable: true })
  preferred_categories?: string[]; // ['정치', '경제', '사회', '생활/문화', 'IT/과학', '세계', '스포츠', '연예']

  @Column({ type: 'json', nullable: true })
  preferred_media_sources?: string[]; // 선호하는 언론사들

  // 계정 상태
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  last_login?: Date;

  // 관계 설정
  @OneToMany(() => UserNewsInteraction, interaction => interaction.user)
  news_interactions: UserNewsInteraction[];

  @OneToMany(() => Comment, comment => comment.user)
  comments: Comment[];
}