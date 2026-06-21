import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type AlertEventStatus = 'triggering' | 'recovered';

@Entity('alert_events')
@Index(['ruleId', 'status'])
@Index(['ruleId', 'metricName', 'status'], { unique: true, where: "status = 'triggering'" })
export class AlertEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  ruleId: number;

  @Column()
  metricName: string;

  @Column('float')
  value: number;

  @Column({ nullable: true })
  unit: string | null;

  @Column({ type: 'varchar' })
  status: AlertEventStatus;

  @Column('float')
  threshold: number;

  @Column({ type: 'varchar' })
  comparisonType: string;

  @Column({ type: 'float', nullable: true })
  previousValue: number | null;

  @Column({ type: 'float', nullable: true })
  changeRate: number | null;

  @Column({ type: 'datetime', nullable: true })
  recoveredAt: Date | null;

  @Column({ default: '' })
  notificationSent: string;

  @CreateDateColumn()
  triggeredAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
