import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('monitor_snapshots')
@Index(['batchId', 'metricName'], { unique: true })
export class MonitorSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  metricName: string;

  @Column('float')
  value: number;

  @Column()
  status: string;

  @Column({ nullable: true })
  unit: string;

  @Column()
  batchId: string;

  @CreateDateColumn()
  recordedAt: Date;
}
