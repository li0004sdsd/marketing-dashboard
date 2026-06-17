import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('metrics')
export class Metric {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column('float')
  value: number;

  @Column({ nullable: true })
  unit: string;

  @Column()
  category: string;

  @Column({ nullable: true })
  dataSourceId: number;

  @CreateDateColumn()
  timestamp: Date;
}
