import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type ComparisonType = 'above' | 'below' | 'change_rate';
export type AlertRuleStatus = 'enabled' | 'disabled';

@Entity('alert_rules')
export class AlertRule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  metricName: string;

  @Column({ type: 'varchar' })
  comparisonType: ComparisonType;

  @Column('float')
  threshold: number;

  @Column({ default: true })
  enabled: boolean;

  @Column({ default: '' })
  notificationEmail: string;

  @Column({ nullable: true })
  description: string | null;

  @Column({ default: '' })
  severity: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
