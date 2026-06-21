import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { MonitorSnapshot } from './monitor-snapshot.entity';
import { MetricsService } from '../metrics/metrics.service';
import { getAllowedCategories } from '../metrics/metrics-permission';

@Injectable()
export class MonitoringService implements OnModuleInit {
  private snapshotLock: Promise<void> | null = null;

  constructor(
    @InjectRepository(MonitorSnapshot)
    private repo: Repository<MonitorSnapshot>,
    private dataSource: DataSource,
    private metricsService: MetricsService,
  ) {}

  async onModuleInit() {
    try {
      await this.generateSnapshot();
    } catch {
      // 启动时快照生成失败不影响服务启动
    }
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  async generateSnapshot(): Promise<string> {
    if (this.snapshotLock) {
      await this.snapshotLock;
      return this.generateSnapshot();
    }

    let resolveLock: () => void;
    this.snapshotLock = new Promise<void>(resolve => {
      resolveLock = resolve;
    });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const summary = await this.metricsService.getSummary(undefined, 'admin');
      const batchId = this.generateBatchId();

      const thresholds: Record<string, { warn: number; crit: number; above: boolean }> = {
        'Bounce Rate': { warn: 50, crit: 65, above: true },
        'Churn Rate': { warn: 3, crit: 5, above: true },
        'Click-Through Rate': { warn: 2, crit: 1, above: false },
        'Revenue': { warn: 7000, crit: 5000, above: false },
      };

      const snaps = summary.map(s => {
        const t = thresholds[s.name];
        let status = 'normal';
        if (t) {
          if (t.above) {
            if (s.latestValue >= t.crit) status = 'critical';
            else if (s.latestValue >= t.warn) status = 'warning';
          } else {
            if (s.latestValue <= t.crit) status = 'critical';
            else if (s.latestValue <= t.warn) status = 'warning';
          }
        }
        return queryRunner.manager.create(MonitorSnapshot, {
          metricName: s.name,
          value: s.latestValue,
          unit: s.unit,
          status,
          batchId,
        });
      });

      await queryRunner.manager.save(snaps);
      await queryRunner.commitTransaction();

      return batchId;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
      this.snapshotLock = null;
      resolveLock!();
    }
  }

  async getRealtime(role: string) {
    await this.generateSnapshot();
    const snaps = await this.repo.find({ order: { recordedAt: 'DESC' }, take: 100 });
    const latest: Record<string, MonitorSnapshot> = {};
    for (const s of snaps) {
      if (!latest[s.metricName]) latest[s.metricName] = s;
    }
    const allSummary = await this.metricsService.getSummary(undefined, role);
    const allowedNames = new Set(allSummary.map(s => s.name));
    return Object.values(latest).filter(snap => allowedNames.has(snap.metricName));
  }

  async getAlerts(role: string) {
    const realtime = await this.getRealtime(role);
    return realtime.filter(s => s.status !== 'normal');
  }
}
