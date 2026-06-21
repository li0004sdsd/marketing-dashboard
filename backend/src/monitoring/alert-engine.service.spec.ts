import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertEngine } from './alert-engine.service';
import { AlertRuleService } from './alert-rule.service';
import { NotificationService } from './notification.service';
import { AlertRule } from './alert-rule.entity';
import { AlertEvent } from './alert-event.entity';
import { MonitorSnapshot } from './monitor-snapshot.entity';
import { AlertRule as AlertRuleType } from './alert-rule.entity';

describe('AlertEngine', () => {
  let engine: AlertEngine;
  let eventRepo: Repository<AlertEvent>;
  let snapshotRepo: Repository<MonitorSnapshot>;
  let ruleService: AlertRuleService;
  let notificationService: NotificationService;

  const mockRule: AlertRuleType = {
    id: 1,
    name: 'High Revenue Alert',
    metricName: 'Revenue',
    comparisonType: 'above',
    threshold: 9000,
    enabled: true,
    notificationEmail: 'admin@example.com',
    description: 'Alert when revenue exceeds 9000',
    severity: 'warning',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertEngine,
        {
          provide: getRepositoryToken(AlertEvent),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            save: jest.fn().mockResolvedValue({}),
            create: jest.fn().mockImplementation(d => ({ ...d })),
          },
        },
        {
          provide: getRepositoryToken(MonitorSnapshot),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              groupBy: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              getRawOne: jest.fn().mockResolvedValue(null),
            }),
          },
        },
        {
          provide: AlertRuleService,
          useValue: {
            findEnabled: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            sendAlertEmail: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    engine = module.get<AlertEngine>(AlertEngine);
    eventRepo = module.get<Repository<AlertEvent>>(getRepositoryToken(AlertEvent));
    snapshotRepo = module.get<Repository<MonitorSnapshot>>(getRepositoryToken(MonitorSnapshot));
    ruleService = module.get<AlertRuleService>(AlertRuleService);
    notificationService = module.get<NotificationService>(NotificationService);
  });

  function makeSnapshot(
    metricName: string,
    value: number,
    batchId: string,
    unit: string = '',
    status: string = 'normal',
  ): MonitorSnapshot {
    return {
      id: Date.now(),
      metricName,
      value,
      unit,
      status,
      batchId,
      recordedAt: new Date(),
    } as MonitorSnapshot;
  }

  function makeAlertEvent(
    ruleId: number,
    metricName: string,
    status: 'triggering' | 'recovered',
  ): AlertEvent {
    return {
      id: Date.now(),
      ruleId,
      metricName,
      value: 9999,
      unit: 'USD',
      status,
      threshold: 9000,
      comparisonType: 'above',
      previousValue: null,
      changeRate: null,
      recoveredAt: null,
      notificationSent: '',
      triggeredAt: new Date(),
      updatedAt: new Date(),
    } as AlertEvent;
  }

  describe('evaluateBatch', () => {
    it('above 阈值比较: value > threshold 时触发告警', async () => {
      const snapshots = [makeSnapshot('Revenue', 9500, 'batch_001', 'USD')];
      (snapshotRepo.find as jest.Mock).mockResolvedValue(snapshots);
      (ruleService.findEnabled as jest.Mock).mockResolvedValue([mockRule]);

      const result = await engine.evaluateBatch('batch_001');

      expect(result.triggered).toBe(1);
      expect(result.recovered).toBe(0);
      expect(result.skipped).toBe(0);
      expect(eventRepo.save).toHaveBeenCalledTimes(1);
      expect(notificationService.sendAlertEmail).toHaveBeenCalledWith(
        'admin@example.com',
        expect.any(String),
        expect.arrayContaining([expect.objectContaining({ metricName: 'Revenue' })]),
      );
    });

    it('above 阈值比较: value <= threshold 时不触发告警', async () => {
      const snapshots = [makeSnapshot('Revenue', 8500, 'batch_001', 'USD')];
      (snapshotRepo.find as jest.Mock).mockResolvedValue(snapshots);
      (ruleService.findEnabled as jest.Mock).mockResolvedValue([mockRule]);

      const result = await engine.evaluateBatch('batch_001');

      expect(result.triggered).toBe(0);
      expect(eventRepo.save).not.toHaveBeenCalled();
      expect(notificationService.sendAlertEmail).not.toHaveBeenCalled();
    });

    it('below 阈值比较: value < threshold 时触发告警', async () => {
      const belowRule = {
        ...mockRule,
        id: 2,
        name: 'Low Revenue Alert',
        comparisonType: 'below' as const,
        threshold: 5000,
      };
      const snapshots = [makeSnapshot('Revenue', 4000, 'batch_001', 'USD')];
      (snapshotRepo.find as jest.Mock).mockResolvedValue(snapshots);
      (ruleService.findEnabled as jest.Mock).mockResolvedValue([belowRule]);

      const result = await engine.evaluateBatch('batch_001');

      expect(result.triggered).toBe(1);
    });

    it('below 阈值比较: value >= threshold 时不触发告警', async () => {
      const belowRule = {
        ...mockRule,
        id: 2,
        comparisonType: 'below' as const,
        threshold: 5000,
      };
      const snapshots = [makeSnapshot('Revenue', 6000, 'batch_001', 'USD')];
      (snapshotRepo.find as jest.Mock).mockResolvedValue(snapshots);
      (ruleService.findEnabled as jest.Mock).mockResolvedValue([belowRule]);

      const result = await engine.evaluateBatch('batch_001');

      expect(result.triggered).toBe(0);
    });

    it('change_rate 阈值比较: |变化率| > |threshold| 时触发告警', async () => {
      const rateRule = {
        ...mockRule,
        id: 3,
        name: 'Revenue Rate Alert',
        comparisonType: 'change_rate' as const,
        threshold: 10,
      };
      const currentSnapshots = [makeSnapshot('Revenue', 11000, 'batch_002', 'USD')];
      const previousBatch = { batchId: 'batch_001' };
      const previousSnapshots = [makeSnapshot('Revenue', 10000, 'batch_001', 'USD')];

      (snapshotRepo.find as jest.Mock).mockImplementation((opts: any) => {
        if (opts?.where?.batchId === 'batch_002') return Promise.resolve(currentSnapshots);
        if (opts?.where?.batchId === 'batch_001') return Promise.resolve(previousSnapshots);
        return Promise.resolve([]);
      });
      (snapshotRepo.findOne as jest.Mock).mockResolvedValue({ recordedAt: new Date() } as any);
      (snapshotRepo.createQueryBuilder as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(previousBatch),
      });
      (ruleService.findEnabled as jest.Mock).mockResolvedValue([rateRule]);

      const result = await engine.evaluateBatch('batch_002');

      expect(result.triggered).toBe(1);
      const savedEvent = (eventRepo.save as jest.Mock).mock.calls[0][0];
      expect(savedEvent.changeRate).toBeCloseTo(10, 5);
    });

    it('change_rate 阈值比较: |变化率| <= |threshold| 时不触发告警', async () => {
      const rateRule = {
        ...mockRule,
        id: 3,
        comparisonType: 'change_rate' as const,
        threshold: 20,
      };
      const currentSnapshots = [makeSnapshot('Revenue', 11000, 'batch_002', 'USD')];
      const previousBatch = { batchId: 'batch_001' };
      const previousSnapshots = [makeSnapshot('Revenue', 10000, 'batch_001', 'USD')];

      (snapshotRepo.find as jest.Mock).mockImplementation((opts: any) => {
        if (opts?.where?.batchId === 'batch_002') return Promise.resolve(currentSnapshots);
        if (opts?.where?.batchId === 'batch_001') return Promise.resolve(previousSnapshots);
        return Promise.resolve([]);
      });
      (snapshotRepo.findOne as jest.Mock).mockResolvedValue({ recordedAt: new Date() } as any);
      (snapshotRepo.createQueryBuilder as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(previousBatch),
      });
      (ruleService.findEnabled as jest.Mock).mockResolvedValue([rateRule]);

      const result = await engine.evaluateBatch('batch_002');

      expect(result.triggered).toBe(0);
    });

    it('防告警风暴: 同一规则已有 triggering 事件时不再重复触发', async () => {
      const snapshots = [makeSnapshot('Revenue', 9500, 'batch_002', 'USD')];
      const existingEvent = makeAlertEvent(1, 'Revenue', 'triggering');

      (snapshotRepo.find as jest.Mock).mockResolvedValue(snapshots);
      (eventRepo.find as jest.Mock).mockResolvedValue([existingEvent]);
      (ruleService.findEnabled as jest.Mock).mockResolvedValue([mockRule]);

      const result = await engine.evaluateBatch('batch_002');

      expect(result.triggered).toBe(0);
      expect(result.skipped).toBe(1);
      expect(eventRepo.save).not.toHaveBeenCalled();
      expect(notificationService.sendAlertEmail).not.toHaveBeenCalled();
    });

    it('状态恢复: 已触发告警的值回归正常时标记为 recovered', async () => {
      const currentSnapshots = [makeSnapshot('Revenue', 8000, 'batch_002', 'USD')];
      const existingEvent = makeAlertEvent(1, 'Revenue', 'triggering');

      (snapshotRepo.find as jest.Mock).mockResolvedValue(currentSnapshots);
      (eventRepo.find as jest.Mock).mockResolvedValue([existingEvent]);
      (ruleService.findEnabled as jest.Mock).mockResolvedValue([mockRule]);

      const result = await engine.evaluateBatch('batch_002');

      expect(result.recovered).toBe(1);
      expect(result.triggered).toBe(0);
      expect(eventRepo.save).toHaveBeenCalledTimes(1);
      const savedEvent = (eventRepo.save as jest.Mock).mock.calls[0][0];
      expect(savedEvent.status).toBe('recovered');
      expect(savedEvent.recoveredAt).toBeInstanceOf(Date);
    });

    it('恢复后再次触发: 状态从 recovered → triggering 可以重新触发', async () => {
      const snapshots = [makeSnapshot('Revenue', 9500, 'batch_003', 'USD')];
      const recoveredEvent = makeAlertEvent(1, 'Revenue', 'recovered');

      (snapshotRepo.find as jest.Mock).mockResolvedValue(snapshots);
      (eventRepo.find as jest.Mock).mockResolvedValue([recoveredEvent]);
      (ruleService.findEnabled as jest.Mock).mockResolvedValue([mockRule]);

      const result = await engine.evaluateBatch('batch_003');

      expect(result.triggered).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.recovered).toBe(0);
    });

    it('空批次快照时直接返回零结果', async () => {
      (snapshotRepo.find as jest.Mock).mockResolvedValue([]);

      const result = await engine.evaluateBatch('batch_empty');

      expect(result).toEqual({ triggered: 0, recovered: 0, skipped: 0 });
      expect(ruleService.findEnabled).not.toHaveBeenCalled();
    });

    it('禁用的规则不参与评估', async () => {
      const disabledRule = { ...mockRule, id: 5, enabled: false };
      const snapshots = [makeSnapshot('Revenue', 9500, 'batch_001', 'USD')];
      (snapshotRepo.find as jest.Mock).mockResolvedValue(snapshots);
      (ruleService.findEnabled as jest.Mock).mockResolvedValue([]);

      const result = await engine.evaluateBatch('batch_001');

      expect(result.triggered).toBe(0);
      expect(eventRepo.save).not.toHaveBeenCalled();
    });

    it('阈值刚好等于时不触发 (严格比较)', async () => {
      const snapshots = [makeSnapshot('Revenue', 9000, 'batch_001', 'USD')];
      (snapshotRepo.find as jest.Mock).mockResolvedValue(snapshots);
      (ruleService.findEnabled as jest.Mock).mockResolvedValue([mockRule]);

      const result = await engine.evaluateBatch('batch_001');

      expect(result.triggered).toBe(0);
    });

    it('通知发送失败时标记 notificationSent=failed', async () => {
      const snapshots = [makeSnapshot('Revenue', 9500, 'batch_001', 'USD')];
      (snapshotRepo.find as jest.Mock).mockResolvedValue(snapshots);
      (ruleService.findEnabled as jest.Mock).mockResolvedValue([mockRule]);
      (notificationService.sendAlertEmail as jest.Mock).mockRejectedValue(
        new Error('SMTP error'),
      );

      const result = await engine.evaluateBatch('batch_001');

      expect(result.triggered).toBe(1);
      const calls = (eventRepo.save as jest.Mock).mock.calls;
      expect(calls.length).toBe(2);
      const savedEvent = calls[1][0];
      expect(savedEvent.notificationSent).toBe('failed');
    });

    it('change_rate 当 previousValue=0 时避免除零错误', async () => {
      const rateRule = {
        ...mockRule,
        id: 3,
        comparisonType: 'change_rate' as const,
        threshold: 10,
      };
      const currentSnapshots = [makeSnapshot('Revenue', 1000, 'batch_002', 'USD')];
      const previousBatch = { batchId: 'batch_001' };
      const previousSnapshots = [makeSnapshot('Revenue', 0, 'batch_001', 'USD')];

      (snapshotRepo.find as jest.Mock).mockImplementation((opts: any) => {
        if (opts?.where?.batchId === 'batch_002') return Promise.resolve(currentSnapshots);
        if (opts?.where?.batchId === 'batch_001') return Promise.resolve(previousSnapshots);
        return Promise.resolve([]);
      });
      (snapshotRepo.findOne as jest.Mock).mockResolvedValue({ recordedAt: new Date() } as any);
      (snapshotRepo.createQueryBuilder as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(previousBatch),
      });
      (ruleService.findEnabled as jest.Mock).mockResolvedValue([rateRule]);

      const result = await engine.evaluateBatch('batch_002');

      expect(result.triggered).toBe(0);
      const savedEvent = (eventRepo.save as jest.Mock).mock.calls[0]?.[0];
      expect(savedEvent?.changeRate).toBeNull();
    });

    it('多规则并行评估时互不干扰', async () => {
      const rule2 = {
        ...mockRule,
        id: 2,
        name: 'Low Bounce Rate',
        metricName: 'Bounce Rate',
        comparisonType: 'below' as const,
        threshold: 30,
        notificationEmail: '',
      };
      const snapshots = [
        makeSnapshot('Revenue', 9500, 'batch_001', 'USD'),
        makeSnapshot('Bounce Rate', 25, 'batch_001', '%'),
      ];
      (snapshotRepo.find as jest.Mock).mockResolvedValue(snapshots);
      (ruleService.findEnabled as jest.Mock).mockResolvedValue([mockRule, rule2]);

      const result = await engine.evaluateBatch('batch_001');

      expect(result.triggered).toBe(2);
      expect(eventRepo.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('状态流转生命周期测试', () => {
    it('完整生命周期: normal → triggering → recovered → triggering', async () => {
      // Batch 1: normal value, no alert
      (snapshotRepo.find as jest.Mock).mockResolvedValue([
        makeSnapshot('Revenue', 8000, 'batch_1', 'USD'),
      ]);
      (ruleService.findEnabled as jest.Mock).mockResolvedValue([mockRule]);
      let result = await engine.evaluateBatch('batch_1');
      expect(result.triggered).toBe(0);
      expect(result.recovered).toBe(0);

      // Batch 2: exceeds threshold → triggering
      (snapshotRepo.find as jest.Mock).mockResolvedValue([
        makeSnapshot('Revenue', 9500, 'batch_2', 'USD'),
      ]);
      result = await engine.evaluateBatch('batch_2');
      expect(result.triggered).toBe(1);
      expect(result.recovered).toBe(0);

      // Batch 3: still exceeds → skip (anti-storm)
      (eventRepo.find as jest.Mock).mockResolvedValue([
        makeAlertEvent(1, 'Revenue', 'triggering'),
      ]);
      (snapshotRepo.find as jest.Mock).mockResolvedValue([
        makeSnapshot('Revenue', 9800, 'batch_3', 'USD'),
      ]);
      result = await engine.evaluateBatch('batch_3');
      expect(result.triggered).toBe(0);
      expect(result.skipped).toBe(1);

      // Batch 4: back to normal → recovered
      (snapshotRepo.find as jest.Mock).mockResolvedValue([
        makeSnapshot('Revenue', 8500, 'batch_4', 'USD'),
      ]);
      result = await engine.evaluateBatch('batch_4');
      expect(result.recovered).toBe(1);

      // Batch 5: exceeds again → trigger again
      (eventRepo.find as jest.Mock).mockResolvedValue([]);
      (snapshotRepo.find as jest.Mock).mockResolvedValue([
        makeSnapshot('Revenue', 9200, 'batch_5', 'USD'),
      ]);
      result = await engine.evaluateBatch('batch_5');
      expect(result.triggered).toBe(1);
    });
  });
});
