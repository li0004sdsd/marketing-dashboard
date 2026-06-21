import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, DataSource } from 'typeorm';
import { ScheduledSubscription, SubscriptionStatus } from './scheduled-subscription.entity';
import { MonitorSnapshot } from './monitor-snapshot.entity';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { MonitoringService } from './monitoring.service';
import { NotificationService } from './notification.service';

const STUCK_THRESHOLD_MS = 30 * 60 * 1000;
const MAX_CONSECUTIVE_FAILURES = 5;

@Injectable()
export class SubscriptionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SubscriptionService.name);
  private schedulerHandle: ReturnType<typeof setInterval> | null = null;
  private static readonly SCHEDULER_INTERVAL_MS = 60 * 1000;

  constructor(
    @InjectRepository(ScheduledSubscription)
    private readonly subRepo: Repository<ScheduledSubscription>,
    private readonly dataSource: DataSource,
    private readonly monitoringService: MonitoringService,
    private readonly notificationService: NotificationService,
  ) {}

  async onModuleInit() {
    await this.recoverStuckSubscriptions();
    this.startScheduler();
  }

  onModuleDestroy() {
    this.stopScheduler();
  }

  private startScheduler() {
    this.schedulerHandle = setInterval(
      () => this.tick(),
      SubscriptionService.SCHEDULER_INTERVAL_MS,
    );
    this.tick();
  }

  private stopScheduler() {
    if (this.schedulerHandle) {
      clearInterval(this.schedulerHandle);
      this.schedulerHandle = null;
    }
  }

  private async tick() {
    try {
      await this.recoverStuckSubscriptions();
      const dueSubscriptions = await this.findDueSubscriptions();
      for (const sub of dueSubscriptions) {
        await this.executeSubscription(sub);
      }
    } catch (error) {
      this.logger.error('Scheduler tick failed', (error as Error).stack);
    }
  }

  async create(dto: CreateSubscriptionDto): Promise<ScheduledSubscription> {
    const sub = this.subRepo.create({
      name: dto.name,
      cronExpression: dto.cronExpression,
      email: dto.email,
      enabled: dto.enabled ?? true,
      status: 'idle',
      userId: dto.userId,
      consecutiveFailures: 0,
    });
    return this.subRepo.save(sub);
  }

  async findAll(userId?: number): Promise<ScheduledSubscription[]> {
    if (userId) {
      return this.subRepo.find({ where: { userId } });
    }
    return this.subRepo.find();
  }

  async findOne(id: number): Promise<ScheduledSubscription | null> {
    return this.subRepo.findOne({ where: { id } });
  }

  async update(id: number, dto: UpdateSubscriptionDto): Promise<ScheduledSubscription | null> {
    const sub = await this.findOne(id);
    if (!sub) return null;
    Object.assign(sub, dto);
    return this.subRepo.save(sub);
  }

  async remove(id: number): Promise<boolean> {
    const result = await this.subRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async executeSubscription(sub: ScheduledSubscription): Promise<{ batchId: string | null; skipped: boolean }> {
    const acquired = await this.tryAcquireLock(sub.id);
    if (!acquired) {
      this.logger.warn(`Subscription ${sub.id} [${sub.name}] is already executing, skipping`);
      return { batchId: null, skipped: true };
    }

    try {
      const batchId = await this.monitoringService.generateSnapshot();
      const alerts = await this.getAlertsForBatch(batchId);

      if (alerts.length > 0) {
        await this.notificationService.sendAlertEmail(
          sub.email,
          sub.name,
          alerts,
        );
      }

      await this.markSuccess(sub.id, batchId);
      this.logger.log(`Subscription ${sub.id} [${sub.name}] completed successfully, batchId=${batchId}`);
      return { batchId, skipped: false };
    } catch (error) {
      const errMsg = (error as Error).message;
      await this.markFailed(sub.id, errMsg);
      this.logger.error(`Subscription ${sub.id} [${sub.name}] failed: ${errMsg}`);
      return { batchId: null, skipped: false };
    }
  }

  private async tryAcquireLock(subscriptionId: number): Promise<boolean> {
    const result = await this.subRepo
      .createQueryBuilder()
      .update(ScheduledSubscription)
      .set({
        status: 'executing' as SubscriptionStatus,
        lockedAt: new Date(),
      })
      .where('id = :id AND status = :status', {
        id: subscriptionId,
        status: 'idle',
      })
      .execute();

    return (result.affected ?? 0) > 0;
  }

  private async markSuccess(subscriptionId: number, batchId: string): Promise<void> {
    await this.subRepo.update(subscriptionId, {
      status: 'idle',
      lastRunAt: new Date(),
      lastBatchId: batchId,
      lastError: null,
      consecutiveFailures: 0,
      lockedAt: null,
    });
  }

  private async markFailed(subscriptionId: number, error: string): Promise<void> {
    const sub = await this.subRepo.findOne({ where: { id: subscriptionId } });
    if (!sub) return;

    const newFailureCount = sub.consecutiveFailures + 1;
    const shouldDisable = newFailureCount >= MAX_CONSECUTIVE_FAILURES;

    await this.subRepo.update(subscriptionId, {
      status: shouldDisable ? 'failed' : 'idle',
      lastRunAt: new Date(),
      lastError: error,
      consecutiveFailures: newFailureCount,
      lockedAt: null,
      ...(shouldDisable ? { enabled: false } : {}),
    });

    if (shouldDisable) {
      this.logger.warn(
        `Subscription ${subscriptionId} auto-disabled after ${MAX_CONSECUTIVE_FAILURES} consecutive failures`,
      );
    }
  }

  async recoverStuckSubscriptions(): Promise<number> {
    const threshold = new Date(Date.now() - STUCK_THRESHOLD_MS);

    const result = await this.subRepo
      .createQueryBuilder()
      .update(ScheduledSubscription)
      .set({
        status: 'idle',
        lastError: 'Recovered from stuck executing state',
        lockedAt: null,
      })
      .where('status = :status AND lockedAt < :threshold', {
        status: 'executing',
        threshold,
      })
      .execute();

    const recovered = result.affected ?? 0;
    if (recovered > 0) {
      this.logger.warn(`Recovered ${recovered} stuck subscription(s)`);
    }
    return recovered;
  }

  async resetSubscription(id: number): Promise<ScheduledSubscription | null> {
    const sub = await this.findOne(id);
    if (!sub) return null;

    sub.status = 'idle';
    sub.consecutiveFailures = 0;
    sub.lastError = null;
    sub.lockedAt = null;
    sub.enabled = true;

    return this.subRepo.save(sub);
  }

  private async findDueSubscriptions(): Promise<ScheduledSubscription[]> {
    const allEnabled = await this.subRepo.find({
      where: { enabled: true },
    });

    return allEnabled.filter(sub => {
      if (sub.status !== 'idle') return false;
      if (!sub.lastRunAt) return true;

      const now = Date.now();
      const lastRun = new Date(sub.lastRunAt).getTime();
      const intervalMs = this.parseCronToIntervalMs(sub.cronExpression);
      return now - lastRun >= intervalMs;
    });
  }

  private parseCronToIntervalMs(cron: string): number {
    const simpleInterval = cron.match(/^every_(\d+)(min|hour|day)s?$/);
    if (simpleInterval) {
      const value = parseInt(simpleInterval[1], 10);
      const unit = simpleInterval[2];
      switch (unit) {
        case 'min': return value * 60 * 1000;
        case 'hour': return value * 60 * 60 * 1000;
        case 'day': return value * 24 * 60 * 60 * 1000;
      }
    }

    const cronParts = cron.trim().split(/\s+/);
    if (cronParts.length === 5) {
      const minutePart = cronParts[0];
      if (minutePart.startsWith('*/')) {
        const minutes = parseInt(minutePart.slice(2), 10);
        if (!isNaN(minutes)) return minutes * 60 * 1000;
      }
      if (minutePart === '*') return 60 * 1000;
      return 60 * 60 * 1000;
    }

    return 60 * 60 * 1000;
  }

  private async getAlertsForBatch(batchId: string): Promise<MonitorSnapshot[]> {
    return this.dataSource.getRepository(MonitorSnapshot).find({
      where: { batchId, status: Not('normal') },
    });
  }
}
