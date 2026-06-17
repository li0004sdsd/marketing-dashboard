import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('monitor_snapshots')
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

  @CreateDateColumn()
  recordedAt: Date;
}
