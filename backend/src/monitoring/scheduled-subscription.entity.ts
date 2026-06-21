import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type SubscriptionStatus = 'idle' | 'executing' | 'failed';

@Entity('scheduled_subscriptions')
export class ScheduledSubscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  cronExpression: string;

  @Column()
  email: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ default: 'idle' })
  status: SubscriptionStatus;

  @Column({ nullable: true })
  lastRunAt: Date | null;

  @Column({ nullable: true })
  lastBatchId: string | null;

  @Column({ nullable: true })
  lastError: string | null;

  @Column({ default: 0 })
  consecutiveFailures: number;

  @Column({ nullable: true })
  lockedAt: Date | null;

  @Column()
  userId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
