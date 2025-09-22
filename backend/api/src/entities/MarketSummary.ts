import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('market_summary')
export class MarketSummary {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 20 })
  symbol!: string;

  @Column({ length: 100 })
  name!: string;

  @Column('decimal', { precision: 15, scale: 2 })
  price!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  change!: number;

  @Column('decimal', { precision: 5, scale: 2, name: 'change_percent' })
  changePercent!: number;

  @Column({ length: 50, nullable: true })
  market!: string;

  @Column({ length: 10, nullable: true })
  currency!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}