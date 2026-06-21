import { Injectable, OnModuleInit, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { MonitorSnapshot } from './monitor-snapshot.entity';
import { MetricsService } from '../metrics/metrics.service';
import { AlertEngine } from './alert-engine.service';

export interface SnapshotMetricPoint {
  metricName: string;
  value: number | null;
  unit: string | null;
  status: string | null;
  present: boolean;
}

export interface SnapshotBatchInfo {
  batchId: string;
  recordedAt: Date;
  metrics: SnapshotMetricPoint[];
}

export interface MetricDiff {
  metricName: string;
  unit: string | null;
  valueA: number | null;
  valueB: number | null;
  valueDelta: number | null;
  valueChangePercent: number | null;
  statusA: string | null;
  statusB: string | null;
  statusChanged: boolean;
  presentInA: boolean;
  presentInB: boolean;
}

export interface CompareResult {
  snapshotA: SnapshotBatchInfo;
  snapshotB: SnapshotBatchInfo;
  diffs: MetricDiff[];
  summary: {
    totalMetrics: number;
    metricsWithValueChange: number;
    metricsWithStatusChange: number;
    newMetricsInB: number;
    removedMetricsInB: number;
  };
}

const TIMESTAMP_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class MonitoringService implements OnModuleInit {
  private snapshotLock: Promise<void> | null = null;

  constructor(
    @InjectRepository(MonitorSnapshot)
    private repo: Repository<MonitorSnapshot>,
    private dataSource: DataSource,
    private metricsService: MetricsService,
    private alertEngine: AlertEngine,
  ) {}

  async onModuleInit() {
    try {
      await this.generateSnapshot();
    } catch {
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

      this.alertEngine.evaluateBatch(batchId).catch(err => {
        console.error('Alert engine evaluation failed:', err);
      });

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

  async compareSnapshots(tsAStr: string, tsBStr: string, role: string): Promise<CompareResult> {
    const tsA = this.parseTimestamp(tsAStr, 'timestampA');
    const tsB = this.parseTimestamp(tsBStr, 'timestampB');

    if (tsA.getTime() === tsB.getTime()) {
      throw new BadRequestException('两个时间点不能相同');
    }

    const [batchA, batchB] = await Promise.all([
      this.findBatchNearTimestamp(tsA),
      this.findBatchNearTimestamp(tsB),
    ]);

    if (!batchA) {
      throw new NotFoundException(
        `时间点 ${tsAStr} 附近 24 小时内未找到完整快照数据`,
      );
    }
    if (!batchB) {
      throw new NotFoundException(
        `时间点 ${tsBStr} 附近 24 小时内未找到完整快照数据`,
      );
    }

    const [metricsA, metricsB] = await Promise.all([
      this.repo.find({ where: { batchId: batchA.batchId } }),
      this.repo.find({ where: { batchId: batchB.batchId } }),
    ]);

    const expectedCount = await this.getExpectedMetricCount(role);

    this.validateBatchCompleteness(batchA.batchId, tsAStr, metricsA.length, expectedCount);
    this.validateBatchCompleteness(batchB.batchId, tsBStr, metricsB.length, expectedCount);

    const mapA = this.buildMetricMap(metricsA);
    const mapB = this.buildMetricMap(metricsB);

    const allMetricNames = await this.mergeMetricNames(mapA, mapB, role);

    const snapshotAInfo: SnapshotBatchInfo = {
      batchId: batchA.batchId,
      recordedAt: batchA.recordedAt,
      metrics: allMetricNames.map(name => this.toMetricPoint(name, mapA)),
    };

    const snapshotBInfo: SnapshotBatchInfo = {
      batchId: batchB.batchId,
      recordedAt: batchB.recordedAt,
      metrics: allMetricNames.map(name => this.toMetricPoint(name, mapB)),
    };

    const diffs: MetricDiff[] = allMetricNames.map(name =>
      this.computeDiff(name, mapA, mapB),
    );

    let metricsWithValueChange = 0;
    let metricsWithStatusChange = 0;
    let newMetricsInB = 0;
    let removedMetricsInB = 0;

    for (const d of diffs) {
      if (d.presentInA && d.presentInB && d.valueDelta !== null && d.valueDelta !== 0) {
        metricsWithValueChange++;
      }
      if (d.statusChanged) metricsWithStatusChange++;
      if (!d.presentInA && d.presentInB) newMetricsInB++;
      if (d.presentInA && !d.presentInB) removedMetricsInB++;
    }

    return {
      snapshotA: snapshotAInfo,
      snapshotB: snapshotBInfo,
      diffs,
      summary: {
        totalMetrics: allMetricNames.length,
        metricsWithValueChange,
        metricsWithStatusChange,
        newMetricsInB,
        removedMetricsInB,
      },
    };
  }

  private parseTimestamp(value: string, fieldName: string): Date {
    const d = new Date(value);
    if (isNaN(d.getTime())) {
      throw new BadRequestException(`${fieldName} 不是有效的时间戳格式`);
    }
    return d;
  }

  private async findBatchNearTimestamp(ts: Date): Promise<{ batchId: string; recordedAt: Date } | null> {
    const windowStart = new Date(ts.getTime() - TIMESTAMP_WINDOW_MS);
    const windowEnd = new Date(ts.getTime() + TIMESTAMP_WINDOW_MS);

    const beforeRows = await this.repo
      .createQueryBuilder('s')
      .select('s.batchId', 'batchId')
      .addSelect('s.recordedAt', 'recordedAt')
      .where('s.recordedAt BETWEEN :start AND :ts', { start: windowStart, ts })
      .groupBy('s.batchId')
      .orderBy('s.recordedAt', 'DESC')
      .limit(1)
      .getRawOne<{ batchId: string; recordedAt: string }>();

    const afterRows = await this.repo
      .createQueryBuilder('s')
      .select('s.batchId', 'batchId')
      .addSelect('s.recordedAt', 'recordedAt')
      .where('s.recordedAt BETWEEN :ts AND :end', { ts, end: windowEnd })
      .groupBy('s.batchId')
      .orderBy('s.recordedAt', 'ASC')
      .limit(1)
      .getRawOne<{ batchId: string; recordedAt: string }>();

    let best: { batchId: string; recordedAt: string } | null = null;
    let bestDelta = Infinity;

    for (const candidate of [beforeRows, afterRows]) {
      if (!candidate) continue;
      const delta = Math.abs(new Date(candidate.recordedAt).getTime() - ts.getTime());
      if (delta < bestDelta) {
        bestDelta = delta;
        best = candidate;
      }
    }

    if (!best) return null;
    return { batchId: best.batchId, recordedAt: new Date(best.recordedAt) };
  }

  private async getExpectedMetricCount(role: string): Promise<number> {
    const summary = await this.metricsService.getSummary(undefined, role);
    return summary.length;
  }

  private validateBatchCompleteness(
    batchId: string,
    tsLabel: string,
    actualCount: number,
    expectedCount: number,
  ): void {
    if (actualCount === 0) {
      throw new BadRequestException(
        `时间点 ${tsLabel} 对应快照批次 ${batchId} 无任何指标数据，快照不完整`,
      );
    }
    if (actualCount < expectedCount) {
      throw new BadRequestException(
        `时间点 ${tsLabel} 对应快照批次 ${batchId} 指标数据不完整: ` +
        `预期 ${expectedCount} 个指标，实际只有 ${actualCount} 个`,
      );
    }
  }

  private buildMetricMap(metrics: MonitorSnapshot[]): Record<string, MonitorSnapshot> {
    const map: Record<string, MonitorSnapshot> = {};
    for (const m of metrics) {
      map[m.metricName] = m;
    }
    return map;
  }

  private async mergeMetricNames(
    mapA: Record<string, MonitorSnapshot>,
    mapB: Record<string, MonitorSnapshot>,
    role: string,
  ): Promise<string[]> {
    const names = new Set<string>();

    for (const n of Object.keys(mapA)) names.add(n);
    for (const n of Object.keys(mapB)) names.add(n);

    const summary = await this.metricsService.getSummary(undefined, role);
    for (const s of summary) {
      names.add(s.name);
    }

    return Array.from(names).sort();
  }

  private toMetricPoint(
    name: string,
    map: Record<string, MonitorSnapshot>,
  ): SnapshotMetricPoint {
    const m = map[name];
    if (!m) {
      return {
        metricName: name,
        value: null,
        unit: null,
        status: null,
        present: false,
      };
    }
    return {
      metricName: m.metricName,
      value: m.value,
      unit: m.unit,
      status: m.status,
      present: true,
    };
  }

  private computeDiff(
    name: string,
    mapA: Record<string, MonitorSnapshot>,
    mapB: Record<string, MonitorSnapshot>,
  ): MetricDiff {
    const a = mapA[name];
    const b = mapB[name];

    const valueA = a ? a.value : null;
    const valueB = b ? b.value : null;
    const statusA = a ? a.status : null;
    const statusB = b ? b.status : null;
    const unit = b ? b.unit : a ? a.unit : null;

    let valueDelta: number | null = null;
    let valueChangePercent: number | null = null;

    if (a && b && valueA !== null && valueB !== null) {
      valueDelta = parseFloat((valueB - valueA).toFixed(4));
      if (valueA !== 0) {
        valueChangePercent = parseFloat(((valueB - valueA) / Math.abs(valueA) * 100).toFixed(2));
      }
    }

    return {
      metricName: name,
      unit,
      valueA,
      valueB,
      valueDelta,
      valueChangePercent,
      statusA,
      statusB,
      statusChanged: !!(a && b && statusA !== statusB),
      presentInA: !!a,
      presentInB: !!b,
    };
  }
}
