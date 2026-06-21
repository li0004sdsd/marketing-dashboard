import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository, QueryRunner } from 'typeorm';
import { MonitoringService } from './monitoring.service';
import { MonitorSnapshot } from './monitor-snapshot.entity';
import { MetricsService } from '../metrics/metrics.service';

const mockSummaryData = [
  { name: 'Revenue', latestValue: 8500, unit: 'USD', category: 'revenue', changePercent: 5.2, periodChangePercent: 12.5, dataPoints: 30, earliestValue: 7500, avgValue: 8000, startDate: new Date('2026-05-22'), endDate: new Date('2026-06-21') },
  { name: 'Bounce Rate', latestValue: 55, unit: '%', category: 'engagement', changePercent: -2.1, periodChangePercent: 3.0, dataPoints: 30, earliestValue: 53.4, avgValue: 54, startDate: new Date('2026-05-22'), endDate: new Date('2026-06-21') },
  { name: 'Churn Rate', latestValue: 2.5, unit: '%', category: 'retention', changePercent: 0.5, periodChangePercent: -1.2, dataPoints: 30, earliestValue: 2.53, avgValue: 2.4, startDate: new Date('2026-05-22'), endDate: new Date('2026-06-21') },
  { name: 'Click-Through Rate', latestValue: 3.2, unit: '%', category: 'engagement', changePercent: 4.1, periodChangePercent: 8.5, dataPoints: 30, earliestValue: 2.95, avgValue: 3.0, startDate: new Date('2026-05-22'), endDate: new Date('2026-06-21') },
];

describe('MonitoringService', () => {
  let service: MonitoringService;
  let metricsService: MetricsService;
  let repo: Repository<MonitorSnapshot>;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        create: jest.fn().mockImplementation((_entity, data) => data),
        save: jest.fn().mockResolvedValue([]),
        findOne: jest.fn(),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitoringService,
        {
          provide: MetricsService,
          useValue: {
            getSummary: jest.fn().mockResolvedValue(mockSummaryData),
          },
        },
        {
          provide: getRepositoryToken(MonitorSnapshot),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            save: jest.fn().mockResolvedValue({}),
            create: jest.fn().mockImplementation(data => data),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
          },
        },
      ],
    }).compile();

    service = module.get<MonitoringService>(MonitoringService);
    metricsService = module.get<MetricsService>(MetricsService);
    repo = module.get<Repository<MonitorSnapshot>>(getRepositoryToken(MonitorSnapshot));
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAlerts', () => {
    it('正常情况下只返回状态异常的监控快照记录', async () => {
      const mockSnapshots = [
        { id: 1, metricName: 'Revenue', value: 8500, status: 'normal', unit: 'USD', batchId: 'batch_1', recordedAt: new Date() },
        { id: 2, metricName: 'Bounce Rate', value: 55, status: 'warning', unit: '%', batchId: 'batch_1', recordedAt: new Date() },
        { id: 3, metricName: 'Churn Rate', value: 2.5, status: 'normal', unit: '%', batchId: 'batch_1', recordedAt: new Date() },
        { id: 4, metricName: 'Click-Through Rate', value: 1.5, status: 'warning', unit: '%', batchId: 'batch_1', recordedAt: new Date() },
      ];

      (repo.find as jest.Mock).mockResolvedValue(mockSnapshots);

      const result = await service.getAlerts('admin');

      expect(Array.isArray(result)).toBe(true);
      expect(result.every(s => s.status !== 'normal')).toBe(true);
      expect(result.length).toBe(2);
      expect(result.map(s => s.metricName)).toContain('Bounce Rate');
      expect(result.map(s => s.metricName)).toContain('Click-Through Rate');
    });

    it('快照数据为空时返回空结果', async () => {
      (repo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.getAlerts('admin');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([]);
      expect(result.length).toBe(0);
    });
  });

  describe('generateSnapshot 并发幂等性', () => {
    it('并发同时触发快照生成时不会写入重复的快照', async () => {
      let callCount = 0;
      (metricsService.getSummary as jest.Mock).mockImplementation(() => {
        callCount++;
        return new Promise(resolve => {
          setTimeout(() => resolve(mockSummaryData), 10);
        });
      });

      const promises = [
        service.generateSnapshot(),
        service.generateSnapshot(),
        service.generateSnapshot(),
      ];

      const results = await Promise.all(promises);
      const uniqueBatchIds = new Set(results);

      expect(uniqueBatchIds.size).toBe(results.length);
      expect(queryRunner.startTransaction).toHaveBeenCalledTimes(3);
      expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(3);
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(callCount).toBe(3);
    });

    it('内存锁机制确保同一时刻只有一个快照生成在执行', async () => {
      let concurrentExecutions = 0;
      let maxConcurrent = 0;

      (metricsService.getSummary as jest.Mock).mockImplementation(
        () =>
          new Promise(resolve => {
            concurrentExecutions++;
            if (concurrentExecutions > maxConcurrent) {
              maxConcurrent = concurrentExecutions;
            }
            setTimeout(() => {
              concurrentExecutions--;
              resolve(mockSummaryData);
            }, 20);
          }),
      );

      const promises = Array.from({ length: 5 }, () => service.generateSnapshot());
      await Promise.all(promises);

      expect(maxConcurrent).toBe(1);
    });
  });

  describe('异常处理与数据一致性', () => {
    it('底层指标数据获取失败时异常正确传播', async () => {
      const testError = new Error('Metrics service unavailable');
      (metricsService.getSummary as jest.Mock).mockRejectedValue(testError);

      await expect(service.generateSnapshot()).rejects.toThrow('Metrics service unavailable');
    });

    it('指标获取失败时事务回滚，不写入脏数据', async () => {
      const testError = new Error('Database connection failed');
      (metricsService.getSummary as jest.Mock).mockRejectedValue(testError);

      try {
        await service.generateSnapshot();
      } catch {
        // expected
      }

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('写入过程中发生异常时事务回滚，保证数据一致性', async () => {
      (metricsService.getSummary as jest.Mock).mockResolvedValue(mockSummaryData);
      (queryRunner.manager.save as jest.Mock).mockRejectedValue(new Error('Write failed'));

      await expect(service.generateSnapshot()).rejects.toThrow('Write failed');

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('异常后锁被正确释放，后续请求可正常执行', async () => {
      let failNext = true;
      (metricsService.getSummary as jest.Mock).mockImplementation(() => {
        if (failNext) {
          failNext = false;
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve(mockSummaryData);
      });

      try {
        await service.generateSnapshot();
      } catch {
        // expected first failure
      }

      const result = await service.generateSnapshot();

      expect(typeof result).toBe('string');
      expect(result).toMatch(/^batch_/);
      expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('阈值判断准确性', () => {
    it('Bounce Rate 超过警告阈值时状态为 warning', async () => {
      const testSummary = [
        { name: 'Bounce Rate', latestValue: 55, unit: '%', category: 'engagement', changePercent: 0, periodChangePercent: 0, dataPoints: 1, earliestValue: 55, avgValue: 55, startDate: new Date(), endDate: new Date() },
      ];
      (metricsService.getSummary as jest.Mock).mockResolvedValue(testSummary);

      await service.generateSnapshot();

      const savedSnapshots = (queryRunner.manager.save as jest.Mock).mock.calls[0][0];
      const bounceRateSnap = savedSnapshots.find((s: any) => s.metricName === 'Bounce Rate');

      expect(bounceRateSnap.status).toBe('warning');
    });

    it('Revenue 低于严重阈值时状态为 critical', async () => {
      const testSummary = [
        { name: 'Revenue', latestValue: 4500, unit: 'USD', category: 'revenue', changePercent: 0, periodChangePercent: 0, dataPoints: 1, earliestValue: 4500, avgValue: 4500, startDate: new Date(), endDate: new Date() },
      ];
      (metricsService.getSummary as jest.Mock).mockResolvedValue(testSummary);

      await service.generateSnapshot();

      const savedSnapshots = (queryRunner.manager.save as jest.Mock).mock.calls[0][0];
      const revenueSnap = savedSnapshots.find((s: any) => s.metricName === 'Revenue');

      expect(revenueSnap.status).toBe('critical');
    });

    it('正常指标状态为 normal', async () => {
      const testSummary = [
        { name: 'Churn Rate', latestValue: 2.1, unit: '%', category: 'retention', changePercent: 0, periodChangePercent: 0, dataPoints: 1, earliestValue: 2.1, avgValue: 2.1, startDate: new Date(), endDate: new Date() },
      ];
      (metricsService.getSummary as jest.Mock).mockResolvedValue(testSummary);

      await service.generateSnapshot();

      const savedSnapshots = (queryRunner.manager.save as jest.Mock).mock.calls[0][0];
      const churnSnap = savedSnapshots.find((s: any) => s.metricName === 'Churn Rate');

      expect(churnSnap.status).toBe('normal');
    });
  });
});
