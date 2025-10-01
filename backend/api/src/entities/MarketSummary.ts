import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('market_summary')
export class MarketSummary {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({ type: 'varchar', length: 50, name: 'market_type' })
  marketType!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, name: 'current_value' })
  currentValue?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'change_value' })
  changeValue?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'change_percent' })
  changePercent?: number;

  @Column({ type: 'bigint', nullable: true })
  volume?: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true, name: 'trading_value' })
  tradingValue?: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, name: 'high_value' })
  highValue?: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, name: 'low_value' })
  lowValue?: number;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}