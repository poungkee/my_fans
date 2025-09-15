import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';

@Entity('user_preferences')
export class UserPreference {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  user_id: number; // 사용자 ID (FK)

  @Column({ type: 'varchar', length: 50 })
  preference_type: string; // 'category', 'media_source', 'journalist', 'keyword'

  @Column({ type: 'varchar', length: 200 })
  preference_value: string; // 선호 대상 (ex: '정치', '조선일보', '김기자')

  @Column({ type: 'int' })
  preference_score: number; // 선호도 점수 (-100 ~ 100)

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // 관계 설정
  @ManyToOne(() => User, user => user.preferences)
  @JoinColumn({ name: 'user_id' })
  user: User;
}