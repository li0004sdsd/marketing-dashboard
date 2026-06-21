import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SubscriptionService } from './subscription.service';
import { ScheduledSubscription, SubscriptionStatus } from './scheduled-subscription.entity';
import { MonitoringService } from './monitoring.service';
import { NotificationService } from './notification.service';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let subRepo: Repository<ScheduledSubscription>;
  let monitoringService: MonitoringService;
  let notificationService: NotificationService;
  let dataSource: DataSource;

  const mockSubscription: ScheduledSubscription = {
    id: 1,
    name: 'Test Subscription',
    cronExpression: '*/5 * * * *',
    email: 'admin@example.com',
    enabled: true,
    status: 'idle',
    lastRunAt: null,
    lastBatchId: null,
    lastError: null,
    consecutiveFailures: 0,
    lockedAt: null,
    userId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAlerts = [
    { id: 1, metricName: 'Bounce Rate', value: 55, status: 'warning', unit: '%', batchId: 'batch_test' },
    { id: 2, metricName: 'Revenue', value: 4500, status: 'critical', unit: 'USD', batchId: 'batch_test' },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        {
          provide: getRepositoryToken(ScheduledSubscription),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(mockSubscription),
            create: jest.fn().mockImplementation((_entity, data) => data),
            save: jest.fn().mockImplementation(entity => Promise.resolve({ ...mockSubscription, ...entity })),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
            createQueryBuilder: jest.fn().mockReturnValue({
              update: jest.fn().mockReturnThis(),
              set: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              execute: jest.fn().mockResolvedValue({ affected: 0 }),
            }),
          },
        },
        {
          provide: DataSource,
          useValue: {
            getRepository: jest.fn().mockReturnValue({
              find: jest.fn().mockResolvedValue(mockAlerts),
            }),
          },
        },
        {
          provide: MonitoringService,
          useValue: {
            generateSnapshot: jest.fn().mockResolvedValue('batch_test_123'),
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

    service = module.get<SubscriptionService>(SubscriptionService);
    subRepo = module.get<Repository<ScheduledSubscription>>(getRepositoryToken(ScheduledSubscription));
    monitoringService = module.get<MonitoringService>(MonitoringService);
    notificationService = module.get<NotificationService>(NotificationService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('CRUD', () => {
    it('create: 应创建新订阅并初始化状态为 idle', async () => {
      const dto = {
        name: 'New Sub',
        cronExpression: '*/10 * * * *',
        email: 'test@example.com',
        userId: 1,
      };

      const result = await service.create(dto);

      expect(subRepo.create).toHaveBeenCalled();
      expect(subRepo.save).toHaveBeenCalled();
      expect(result.status).toBe('idle');
      expect(result.consecutiveFailures).toBe(0);
    });

    it('findAll: 无 userId 时返回所有订阅', async () => {
      await service.findAll();
      expect(subRepo.find).toHaveBeenCalledWith({});
    });

    it('findAll: 有 userId 时按用户过滤', async () => {
      await service.findAll(1);
      expect(subRepo.find).toHaveBeenCalledWith({ where: { userId: 1 } });
    });

    it('findOne: 返回指定 ID 的订阅', async () => {
      const result = await service.findOne(1);
      expect(result).toEqual(mockSubscription);
    });

    it('update: 更新订阅字段', async () => {
      const result = await service.update(1, { name: 'Updated' });
      expect(subRepo.save).toHaveBeenCalled();
    });

    it('remove: 删除订阅返回 true', async () => {
      const result = await service.remove(1);
      expect(result).toBe(true);
    });

    it('remove: 不存在时返回 false', async () => {
      (subRepo.delete as jest.Mock).mockResolvedValue({ affected: 0 });
      const result = await service.remove(999);
      expect(result).toBe(false);
    });
  });

  describe('状态流转与幂等保护', () => {
    it('idle → executing → idle: 正常执行成功后状态回归 idle', async () => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      (subRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.executeSubscription(mockSubscription);

      expect(result.skipped).toBe(false);
      expect(result.batchId).toBe('batch_test_123');
      expect(qb.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'executing' }),
      );
      expect(subRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: 'idle',
          lastBatchId: 'batch_test_123',
          consecutiveFailures: 0,
          lastError: null,
        }),
      );
    });

    it('idle → executing → failed: 执行失败时状态变为 failed (达到最大连续失败)', async () => {
      (monitoringService.generateSnapshot as jest.Mock).mockRejectedValue(
        new Error('Service unavailable'),
      );

      const failedSub = { ...mockSubscription, consecutiveFailures: 4 };
      (subRepo.findOne as jest.Mock).mockResolvedValue(failedSub);

      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      (subRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.executeSubscription(mockSubscription);

      expect(result.batchId).toBeNull();
      expect(subRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: 'failed',
          enabled: false,
          consecutiveFailures: 5,
          lastError: 'Service unavailable',
        }),
      );
    });

    it('idle → executing → idle: 失败但未达阈值时状态回归 idle', async () => {
      (monitoringService.generateSnapshot as jest.Mock).mockRejectedValue(
        new Error('Transient error'),
      );

      const normalSub = { ...mockSubscription, consecutiveFailures: 2 };
      (subRepo.findOne as jest.Mock).mockResolvedValue(normalSub);

      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      (subRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.executeSubscription(mockSubscription);

      expect(subRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: 'idle',
          consecutiveFailures: 3,
          lastError: 'Transient error',
        }),
      );
    });

    it('幂等保护: 状态为 executing 时跳过执行', async () => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      (subRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.executeSubscription(mockSubscription);

      expect(result.skipped).toBe(true);
      expect(result.batchId).toBeNull();
      expect(monitoringService.generateSnapshot).not.toHaveBeenCalled();
    });

    it('幂等保护: 状态为 failed 时也跳过执行', async () => {
      const failedSub = { ...mockSubscription, status: 'failed' as SubscriptionStatus };
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      (subRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.executeSubscription(failedSub);

      expect(result.skipped).toBe(true);
      expect(monitoringService.generateSnapshot).not.toHaveBeenCalled();
    });
  });

  describe('邮件通知', () => {
    it('执行成功且有告警时发送邮件通知', async () => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      (subRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.executeSubscription(mockSubscription);

      expect(notificationService.sendAlertEmail).toHaveBeenCalledWith(
        'admin@example.com',
        'Test Subscription',
        mockAlerts,
      );
    });

    it('执行成功但无告警时不发送邮件', async () => {
      (dataSource.getRepository as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([]),
      });

      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      (subRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.executeSubscription(mockSubscription);

      expect(notificationService.sendAlertEmail).not.toHaveBeenCalled();
    });
  });

  describe('异常恢复', () => {
    it('recoverStuckSubscriptions: 超时卡住的 executing 状态恢复为 idle', async () => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 2 }),
      };
      (subRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const recovered = await service.recoverStuckSubscriptions();

      expect(recovered).toBe(2);
      expect(qb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'idle',
          lastError: 'Recovered from stuck executing state',
          lockedAt: null,
        }),
      );
    });

    it('recoverStuckSubscriptions: 无卡住任务时返回 0', async () => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      (subRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const recovered = await service.recoverStuckSubscriptions();
      expect(recovered).toBe(0);
    });

    it('resetSubscription: 手动重置失败订阅恢复到 idle 并启用', async () => {
      const failedSub = {
        ...mockSubscription,
        status: 'failed' as SubscriptionStatus,
        consecutiveFailures: 5,
        enabled: false,
        lastError: 'Some error',
      };
      (subRepo.findOne as jest.Mock).mockResolvedValue(failedSub);
      (subRepo.save as jest.Mock).mockImplementation(entity =>
        Promise.resolve({ ...failedSub, ...entity }),
      );

      const result = await service.resetSubscription(1);

      expect(result.status).toBe('idle');
      expect(result.consecutiveFailures).toBe(0);
      expect(result.enabled).toBe(true);
      expect(result.lastError).toBeNull();
    });

    it('resetSubscription: 不存在的订阅返回 null', async () => {
      (subRepo.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.resetSubscription(999);
      expect(result).toBeNull();
    });
  });

  describe('定时调度逻辑', () => {
    it('从未执行过的启用订阅应被视为到期', async () => {
      const neverRun = { ...mockSubscription, lastRunAt: null, status: 'idle' as SubscriptionStatus };
      (subRepo.find as jest.Mock).mockResolvedValue([neverRun]);

      const due = await (service as any).findDueSubscriptions();

      expect(due.length).toBe(1);
      expect(due[0].id).toBe(1);
    });

    it('状态为 executing 的订阅不被视为到期', async () => {
      const executingSub = { ...mockSubscription, status: 'executing' as SubscriptionStatus };
      (subRepo.find as jest.Mock).mockResolvedValue([executingSub]);

      const due = await (service as any).findDueSubscriptions();

      expect(due.length).toBe(0);
    });

    it('禁用的订阅不被视为到期', async () => {
      const disabledSub = { ...mockSubscription, enabled: false };
      (subRepo.find as jest.Mock).mockResolvedValue([disabledSub]);

      const due = await (service as any).findDueSubscriptions();

      expect(due.length).toBe(0);
    });

    it('最近已执行且未到间隔的订阅不被视为到期', async () => {
      const recentRun = {
        ...mockSubscription,
        lastRunAt: new Date(),
        cronExpression: '*/30 * * * *',
      };
      (subRepo.find as jest.Mock).mockResolvedValue([recentRun]);

      const due = await (service as any).findDueSubscriptions();

      expect(due.length).toBe(0);
    });

    it('已过间隔时间的订阅被视为到期', async () => {
      const pastRun = {
        ...mockSubscription,
        lastRunAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        cronExpression: 'every_1hour',
      };
      (subRepo.find as jest.Mock).mockResolvedValue([pastRun]);

      const due = await (service as any).findDueSubscriptions();

      expect(due.length).toBe(1);
    });
  });

  describe('cron 表达式解析', () => {
    it('every_Nmin 格式解析为分钟间隔', () => {
      const ms = (service as any).parseCronToIntervalMs('every_5min');
      expect(ms).toBe(5 * 60 * 1000);
    });

    it('every_Nhour 格式解析为小时间隔', () => {
      const ms = (service as any).parseCronToIntervalMs('every_2hour');
      expect(ms).toBe(2 * 60 * 60 * 1000);
    });

    it('every_Nday 格式解析为天间隔', () => {
      const ms = (service as any).parseCronToIntervalMs('every_1day');
      expect(ms).toBe(24 * 60 * 60 * 1000);
    });

    it('标准 cron */N 格式解析', () => {
      const ms = (service as any).parseCronToIntervalMs('*/15 * * * *');
      expect(ms).toBe(15 * 60 * 1000);
    });

    it('标准 cron 分钟通配符解析为每分钟', () => {
      const ms = (service as any).parseCronToIntervalMs('* * * * *');
      expect(ms).toBe(60 * 1000);
    });

    it('无法识别的格式默认为 1 小时间隔', () => {
      const ms = (service as any).parseCronToIntervalMs('0 8 * * *');
      expect(ms).toBe(60 * 60 * 1000);
    });
  });

  describe('连续失败自动禁用', () => {
    it('连续失败达到阈值自动禁用订阅并标记为 failed', async () => {
      (monitoringService.generateSnapshot as jest.Mock).mockRejectedValue(
        new Error('Persistent failure'),
      );

      const subNearLimit = { ...mockSubscription, consecutiveFailures: 4 };
      (subRepo.findOne as jest.Mock).mockResolvedValue(subNearLimit);

      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      (subRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.executeSubscription(subNearLimit);

      expect(subRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: 'failed',
          enabled: false,
          consecutiveFailures: 5,
        }),
      );
    });

    it('连续失败未达阈值时保持 idle 但记录失败次数', async () => {
      (monitoringService.generateSnapshot as jest.Mock).mockRejectedValue(
        new Error('Temporary failure'),
      );

      const subNormal = { ...mockSubscription, consecutiveFailures: 1 };
      (subRepo.findOne as jest.Mock).mockResolvedValue(subNormal);

      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      (subRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.executeSubscription(subNormal);

      expect(subRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: 'idle',
          enabled: undefined,
          consecutiveFailures: 2,
        }),
      );
    });
  });

  describe('成功执行后重置失败计数', () => {
    it('成功执行后 consecutiveFailures 重置为 0', async () => {
      const subWithFailures = { ...mockSubscription, consecutiveFailures: 3 };

      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      (subRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.executeSubscription(subWithFailures);

      expect(subRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          consecutiveFailures: 0,
          lastError: null,
        }),
      );
    });
  });
});
