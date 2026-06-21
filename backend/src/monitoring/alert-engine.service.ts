import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AlertRule } from './alert-rule.entity';
import { AlertEvent, AlertEventStatus } from './alert-event.entity';
import { MonitorSnapshot } from './monitor-snapshot.entity';
import { NotificationService } from './notification.service';
import { AlertRuleService } from './alert-rule.service';

export interface EvaluationResult {
  ruleId: number;
  metricName: string;
  triggered: boolean;
  value: number;
  previousValue: number | null;
  changeRate: number | null;
  threshold: number;
  comparisonType: string;
}

export type RuleEvaluation = {
  triggered: boolean;
  value: number;
  previousValue: number | null;
  changeRate: number | null;
  threshold: number;
  comparisonType: string;
};

@Injectable()
export class AlertEngine {
  private readonly logger = new Logger(AlertEngine.name);

  constructor(
    @InjectRepository(AlertEvent)
    private readonly eventRepo: Repository<AlertEvent>,
    @InjectRepository(MonitorSnapshot)
    private readonly snapshotRepo: Repository<MonitorSnapshot>,
    private readonly ruleService: AlertRuleService,
    private readonly notificationService: NotificationService,
  ) {}

  async evaluateBatch(batchId: string): Promise<{
    triggered: number;
    recovered: number;
    skipped: number;
  }> {
    const currentSnapshots = await this.snapshotRepo.find({ where: { batchId } });
    if (currentSnapshots.length === 0) {
      this.logger.warn(`No snapshots found for batch ${batchId}, skipping evaluation`);
      return { triggered: 0, recovered: 0, skipped: 0 };
    }

    const currentMap: Record<string, MonitorSnapshot> = {};
    for (const s of currentSnapshots) {
      currentMap[s.metricName] = s;
    }

    const enabledRules = await this.ruleService.findEnabled();
    const metricNames = enabledRules.map(r => r.metricName);

    const previousBatch = await this.findPreviousBatch(batchId, metricNames);
    const previousMap: Record<string, MonitorSnapshot> = {};
    for (const s of previousBatch) {
      previousMap[s.metricName] = s;
    }

    const triggeringEvents = await this.eventRepo.find({
      where: { status: 'triggering' as AlertEventStatus },
    });
    const triggeringMap: Record<string, AlertEvent> = {};
    for (const e of triggeringEvents) {
      triggeringMap[`${e.ruleId}_${e.metricName}`] = e;
    }

    let triggeredCount = 0;
    let recoveredCount = 0;
    let skippedCount = 0;

    for (const rule of enabledRules) {
      const current = currentMap[rule.metricName];
      if (!current) {
        continue;
      }

      const previous = previousMap[rule.metricName];
      const key = `${rule.id}_${rule.metricName}`;
      const existingEvent = triggeringMap[key];

      const result = this.evaluateRule(rule, current, previous);

      if (result.triggered) {
        if (existingEvent) {
          skippedCount++;
          this.logger.debug(
            `Rule ${rule.id} [${rule.name}] already triggering, skipping (anti-storm)`,
          );
        } else {
          await this.createTriggeringEvent(rule, current, previous, result);
          triggeredCount++;
          this.logger.log(
            `Rule ${rule.id} [${rule.name}] triggered: ${current.metricName}=${current.value} ${rule.comparisonType} ${rule.threshold}`,
          );
        }
      } else if (existingEvent) {
        await this.markAsRecovered(existingEvent, current);
        recoveredCount++;
        this.logger.log(
          `Rule ${rule.id} [${rule.name}] recovered: ${current.metricName}=${current.value} is now normal`,
        );
      }
    }

    return { triggered: triggeredCount, recovered: recoveredCount, skipped: skippedCount };
  }

  private evaluateRule(
    rule: AlertRule,
    current: MonitorSnapshot,
    previous: MonitorSnapshot | null,
  ): {
    triggered: boolean;
    value: number;
    previousValue: number | null;
    changeRate: number | null;
    threshold: number;
    comparisonType: string;
  } {
    const value = current.value;
    const previousValue = previous ? previous.value : null;
    let changeRate: number | null = null;
    let triggered = false;

    switch (rule.comparisonType) {
      case 'above':
        triggered = value > rule.threshold;
        break;
      case 'below':
        triggered = value < rule.threshold;
        break;
      case 'change_rate':
        if (previousValue !== null && previousValue !== 0) {
          changeRate = ((value - previousValue) / Math.abs(previousValue)) * 100;
          triggered = Math.abs(changeRate) > Math.abs(rule.threshold);
        }
        break;
    }

    return { triggered, value, previousValue, changeRate, threshold: rule.threshold, comparisonType: rule.comparisonType };
  }

  private async createTriggeringEvent(
    rule: AlertRule,
    current: MonitorSnapshot,
    previous: MonitorSnapshot | null,
    result: {
      triggered: boolean;
      value: number;
      previousValue: number | null;
      changeRate: number | null;
      threshold: number;
      comparisonType: string;
    },
  ): Promise<AlertEvent> {
    const event = this.eventRepo.create({
      ruleId: rule.id,
      metricName: current.metricName,
      value: current.value,
      unit: current.unit,
      status: 'triggering' as AlertEventStatus,
      threshold: rule.threshold,
      comparisonType: rule.comparisonType,
      previousValue: result.previousValue,
      changeRate: result.changeRate,
      notificationSent: '',
    });

    const saved = await this.eventRepo.save(event);

    if (rule.notificationEmail) {
      try {
        await this.notificationService.sendAlertEmail(
          rule.notificationEmail,
          `告警规则: ${rule.name}`,
          [current],
        );
        saved.notificationSent = 'sent';
        await this.eventRepo.save(saved);
      } catch (error) {
        this.logger.error(
          `Failed to send notification for rule ${rule.id}: ${(error as Error).message}`,
        );
        saved.notificationSent = 'failed';
        await this.eventRepo.save(saved);
      }
    }

    return saved;
  }

  private async markAsRecovered(
    event: AlertEvent,
    current: MonitorSnapshot,
  ): Promise<AlertEvent> {
    event.status = 'recovered' as AlertEventStatus;
    event.recoveredAt = new Date();
    return this.eventRepo.save(event);
  }

  private async findPreviousBatch(
    currentBatchId: string,
    metricNames: string[],
  ): Promise<MonitorSnapshot[]> {
    const current = await this.snapshotRepo.findOne({
      where: { batchId: currentBatchId },
      select: ['recordedAt'],
    });
    if (!current) return [];

    const previousBatch = await this.snapshotRepo
      .createQueryBuilder('s')
      .select('s.batchId')
      .where('s.recordedAt < :ts', { ts: current.recordedAt })
      .andWhere('s.metricName IN (:...names)', { names: metricNames })
      .groupBy('s.batchId')
      .orderBy('s.recordedAt', 'DESC')
      .limit(1)
      .getRawOne<{ batchId: string }>();

    if (!previousBatch) return [];

    return this.snapshotRepo.find({
      where: { batchId: previousBatch.batchId, metricName: In(metricNames) },
    });
  }

  async getActiveAlerts(): Promise<AlertEvent[]> {
    return this.eventRepo.find({
      where: { status: 'triggering' as AlertEventStatus },
      order: { triggeredAt: 'DESC' },
    });
  }

  async getAlertHistory(limit: number = 100): Promise<AlertEvent[]> {
    return this.eventRepo.find({
      order: { triggeredAt: 'DESC' },
      take: limit,
    });
  }

  async getAlertsByRule(ruleId: number): Promise<AlertEvent[]> {
    return this.eventRepo.find({
      where: { ruleId },
      order: { triggeredAt: 'DESC' },
    });
  }
}
