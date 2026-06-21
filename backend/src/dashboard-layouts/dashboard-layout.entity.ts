import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('dashboard_layouts')
@Index(['userId', 'name'], { unique: true })
export class DashboardLayout {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'json' })
  layoutConfig: {
    widgets: Array<{
      id: string;
      type: string;
      metricIds: number[];
      position: { x: number; y: number };
      size: { width: number; height: number };
      settings?: Record<string, any>;
    }>;
    gridCols?: number;
    rowHeight?: number;
  };

  @Column({ default: false })
  isDefault: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
