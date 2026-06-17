import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MonitorSnapshot } from './monitor-snapshot.entity';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class MonitoringService implements OnModuleInit {
  constructor(
    @InjectRepository(MonitorSnapshot)
    private repo: Repository<MonitorSnapshot>,
    private metricsService: MetricsService,
  ) {}

  async onModuleInit() {
    await this.generateSnapshot();
  }

  async generateSnapshot() {
    const summary = await this.metricsService.getSummary();
    for (const s of summary) {
      const thresholds: Record<string, { warn: number; crit: number; above: boolean }> = {
        'Bounce Rate': { warn: 50, crit: 65, above: true },
        'Churn Rate': { warn: 3, crit: 5, above: true },
        'Click-Through Rate': { warn: 2, crit: 1, above: false },
        'Revenue': { warn: 7000, crit: 5000, above: false },
      };
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
      const snap = this.repo.create({
        metricName: s.name,
        value: s.latestValue,
        unit: s.unit,
        status,
      });
      await this.repo.save(snap);
    }
  }

  async getRealtime() {
    await this.generateSnapshot();
    const snaps = await this.repo.find({ order: { recordedAt: 'DESC' }, take: 50 });
    const latest: Record<string, MonitorSnapshot> = {};
    for (const s of snaps) {
      if (!latest[s.metricName]) latest[s.metricName] = s;
    }
    return Object.values(latest);
  }

  async getAlerts() {
    const realtime = await this.getRealtime();
    return realtime.filter(s => s.status !== 'normal');
  }
}
