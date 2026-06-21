import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              addSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              groupBy: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              setParameter: jest.fn().mockReturnThis(),
              getRawOne: jest.fn().mockResolvedValue(null),
              getRawMany: jest.fn().mockResolvedValue([]),
            }),
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

  describe('compareSnapshots 历史快照对比', () => {
    const tsA = '2026-06-15T00:00:00.000Z';
    const tsB = '2026-06-20T00:00:00.000Z';

    function makeBatchMetrics(
      batchId: string,
      entries: { metricName: string; value: number; status: string }[],
      recordedAt: Date,
    ): MonitorSnapshot[] {
      return entries.map((e, i) => ({
        id: i + 1,
        metricName: e.metricName,
        value: e.value,
        unit: e.metricName === 'Revenue' ? 'USD' : '%',
        status: e.status,
        batchId,
        recordedAt,
      })) as any;
    }

    function setupBatchLookup(
      repoMock: any,
      mapping: Record<string, { batchId: string; recordedAt: string } | null>,
    ) {
      (repoMock.createQueryBuilder as jest.Mock).mockImplementation(() => {
        let callIndex = 0;
        return {
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          setParameter: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockImplementation(() => {
            const keys = Object.keys(mapping);
            const key = keys[callIndex % keys.length];
            callIndex++;
            return Promise.resolve(mapping[key]);
          }),
          getRawMany: jest.fn().mockResolvedValue([]),
        };
      });
    }

    it('时间戳格式无效时抛出 BadRequestException', async () => {
      await expect(
        service.compareSnapshots('not-a-date', tsB, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('两个时间戳相同时抛出 BadRequestException', async () => {
      await expect(
        service.compareSnapshots(tsA, tsA, 'admin'),
      ).rejects.toThrow('两个时间点不能相同');
    });

    it('找不到快照批次时抛出 NotFoundException', async () => {
      setupBatchLookup(repo, { tsA: null, tsB: null });

      await expect(
        service.compareSnapshots(tsA, tsB, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('快照批次指标数为 0 时判定不完整', async () => {
      setupBatchLookup(repo, {
        tsA: { batchId: 'batch_A', recordedAt: tsA },
        tsB: { batchId: 'batch_B', recordedAt: tsB },
      });
      (repo.find as jest.Mock).mockResolvedValue([]);

      await expect(
        service.compareSnapshots(tsA, tsB, 'admin'),
      ).rejects.toThrow(/快照不完整/);
    });

    it('快照批次指标数少于预期时判定不完整', async () => {
      setupBatchLookup(repo, {
        tsA: { batchId: 'batch_A', recordedAt: tsA },
        tsB: { batchId: 'batch_B', recordedAt: tsB },
      });
      const partialMetrics = makeBatchMetrics(
        'batch_A',
        [{ metricName: 'Revenue', value: 8000, status: 'normal' }],
        new Date(tsA),
      );
      (repo.find as jest.Mock).mockImplementation((opts: any) => {
        if (opts?.where?.batchId === 'batch_A') return Promise.resolve(partialMetrics);
        if (opts?.where?.batchId === 'batch_B') return Promise.resolve([]);
        return Promise.resolve([]);
      });

      await expect(
        service.compareSnapshots(tsA, tsB, 'admin'),
      ).rejects.toThrow(/指标数据不完整/);
    });

    it('正常对比: 返回两个快照完整指标、diff 和 summary', async () => {
      setupBatchLookup(repo, {
        tsA: { batchId: 'batch_A', recordedAt: tsA },
        tsB: { batchId: 'batch_B', recordedAt: tsB },
      });

      const metricsA = makeBatchMetrics(
        'batch_A',
        [
          { metricName: 'Revenue', value: 8000, status: 'normal' },
          { metricName: 'Bounce Rate', value: 42, status: 'normal' },
          { metricName: 'Churn Rate', value: 2.1, status: 'normal' },
          { metricName: 'Click-Through Rate', value: 3.0, status: 'normal' },
        ],
        new Date(tsA),
      );

      const metricsB = makeBatchMetrics(
        'batch_B',
        [
          { metricName: 'Revenue', value: 8800, status: 'normal' },
          { metricName: 'Bounce Rate', value: 58, status: 'warning' },
          { metricName: 'Churn Rate', value: 2.1, status: 'normal' },
          { metricName: 'Click-Through Rate', value: 2.5, status: 'warning' },
        ],
        new Date(tsB),
      );

      (repo.find as jest.Mock).mockImplementation((opts: any) => {
        if (opts?.where?.batchId === 'batch_A') return Promise.resolve(metricsA);
        if (opts?.where?.batchId === 'batch_B') return Promise.resolve(metricsB);
        return Promise.resolve([]);
      });

      const result = await service.compareSnapshots(tsA, tsB, 'admin');

      expect(result.snapshotA.batchId).toBe('batch_A');
      expect(result.snapshotB.batchId).toBe('batch_B');

      expect(result.snapshotA.metrics.length).toBe(4);
      expect(result.snapshotB.metrics.length).toBe(4);
      expect(result.snapshotA.metrics.every(m => m.present === true)).toBe(true);
      expect(result.snapshotB.metrics.every(m => m.present === true)).toBe(true);

      expect(result.diffs.length).toBe(4);

      const revenueDiff = result.diffs.find(d => d.metricName === 'Revenue')!;
      expect(revenueDiff.valueA).toBe(8000);
      expect(revenueDiff.valueB).toBe(8800);
      expect(revenueDiff.valueDelta).toBe(800);
      expect(revenueDiff.valueChangePercent).toBeCloseTo(10, 1);
      expect(revenueDiff.statusChanged).toBe(false);

      const bounceDiff = result.diffs.find(d => d.metricName === 'Bounce Rate')!;
      expect(bounceDiff.statusA).toBe('normal');
      expect(bounceDiff.statusB).toBe('warning');
      expect(bounceDiff.statusChanged).toBe(true);

      expect(result.summary.totalMetrics).toBe(4);
      expect(result.summary.metricsWithStatusChange).toBe(2);
      expect(result.summary.newMetricsInB).toBe(0);
      expect(result.summary.removedMetricsInB).toBe(0);
    });

    it('向前兼容: A 无新指标、B 新增指标时, A 侧标记 present=false, value=null', async () => {
      setupBatchLookup(repo, {
        tsA: { batchId: 'batch_A', recordedAt: tsA },
        tsB: { batchId: 'batch_B', recordedAt: tsB },
      });

      const metricsA = makeBatchMetrics(
        'batch_A',
        [
          { metricName: 'Revenue', value: 8000, status: 'normal' },
          { metricName: 'Bounce Rate', value: 42, status: 'normal' },
          { metricName: 'Churn Rate', value: 2.1, status: 'normal' },
          { metricName: 'Click-Through Rate', value: 3.0, status: 'normal' },
        ],
        new Date(tsA),
      );

      const metricsB = makeBatchMetrics(
        'batch_B',
        [
          { metricName: 'Revenue', value: 8800, status: 'normal' },
          { metricName: 'Bounce Rate', value: 58, status: 'warning' },
          { metricName: 'Churn Rate', value: 2.1, status: 'normal' },
          { metricName: 'Click-Through Rate', value: 2.5, status: 'warning' },
          { metricName: 'New Metric', value: 42, status: 'normal' },
        ],
        new Date(tsB),
      );

      const summaryWithNewMetric = [
        ...mockSummaryData,
        { name: 'New Metric', latestValue: 42, unit: 'units', category: 'revenue', changePercent: 0, periodChangePercent: 0, dataPoints: 1, earliestValue: 42, avgValue: 42, startDate: new Date(tsB), endDate: new Date(tsB) },
      ];
      (metricsService.getSummary as jest.Mock).mockResolvedValue(summaryWithNewMetric);

      (repo.find as jest.Mock).mockImplementation((opts: any) => {
        if (opts?.where?.batchId === 'batch_A') return Promise.resolve(metricsA);
        if (opts?.where?.batchId === 'batch_B') return Promise.resolve(metricsB);
        return Promise.resolve([]);
      });

      const result = await service.compareSnapshots(tsA, tsB, 'admin');

      const newMetric = result.diffs.find(d => d.metricName === 'New Metric')!;
      expect(newMetric).toBeDefined();
      expect(newMetric.presentInA).toBe(false);
      expect(newMetric.presentInB).toBe(true);
      expect(newMetric.valueA).toBeNull();
      expect(newMetric.valueB).toBe(42);
      expect(newMetric.valueDelta).toBeNull();
      expect(newMetric.valueChangePercent).toBeNull();
      expect(newMetric.statusChanged).toBe(false);

      const aMissing = result.snapshotA.metrics.find(m => m.metricName === 'New Metric')!;
      expect(aMissing.present).toBe(false);
      expect(aMissing.value).toBeNull();

      expect(result.summary.newMetricsInB).toBe(1);
      expect(result.summary.totalMetrics).toBe(5);
    });

    it('向前兼容: A 有旧指标但 B 无该指标时, B 侧标记 present=false', async () => {
      setupBatchLookup(repo, {
        tsA: { batchId: 'batch_A', recordedAt: tsA },
        tsB: { batchId: 'batch_B', recordedAt: tsB },
      });

      const metricsA = makeBatchMetrics(
        'batch_A',
        [
          { metricName: 'Revenue', value: 8000, status: 'normal' },
          { metricName: 'Bounce Rate', value: 42, status: 'normal' },
          { metricName: 'Churn Rate', value: 2.1, status: 'normal' },
          { metricName: 'Click-Through Rate', value: 3.0, status: 'normal' },
          { metricName: 'Deprecated Metric', value: 99, status: 'normal' },
        ],
        new Date(tsA),
      );

      const metricsB = makeBatchMetrics(
        'batch_B',
        [
          { metricName: 'Revenue', value: 8800, status: 'normal' },
          { metricName: 'Bounce Rate', value: 58, status: 'warning' },
          { metricName: 'Churn Rate', value: 2.1, status: 'normal' },
          { metricName: 'Click-Through Rate', value: 2.5, status: 'warning' },
        ],
        new Date(tsB),
      );

      (repo.find as jest.Mock).mockImplementation((opts: any) => {
        if (opts?.where?.batchId === 'batch_A') return Promise.resolve(metricsA);
        if (opts?.where?.batchId === 'batch_B') return Promise.resolve(metricsB);
        return Promise.resolve([]);
      });

      const result = await service.compareSnapshots(tsA, tsB, 'admin');

      const deprecatedDiff = result.diffs.find(d => d.metricName === 'Deprecated Metric')!;
      expect(deprecatedDiff).toBeDefined();
      expect(deprecatedDiff.presentInA).toBe(true);
      expect(deprecatedDiff.presentInB).toBe(false);
      expect(deprecatedDiff.valueA).toBe(99);
      expect(deprecatedDiff.valueB).toBeNull();
      expect(deprecatedDiff.statusChanged).toBe(false);

      expect(result.summary.removedMetricsInB).toBe(1);
      expect(result.summary.totalMetrics).toBe(5);
    });

    it('向前兼容: 合并 union(metricsA ∪ metricsB ∪ 实时最新指标列表)', async () => {
      setupBatchLookup(repo, {
        tsA: { batchId: 'batch_A', recordedAt: tsA },
        tsB: { batchId: 'batch_B', recordedAt: tsB },
      });

      const metricsA = makeBatchMetrics(
        'batch_A',
        [
          { metricName: 'Revenue', value: 8000, status: 'normal' },
          { metricName: 'Bounce Rate', value: 42, status: 'normal' },
        ],
        new Date(tsA),
      );

      const metricsB = makeBatchMetrics(
        'batch_B',
        [
          { metricName: 'Revenue', value: 8800, status: 'normal' },
          { metricName: 'Click-Through Rate', value: 2.5, status: 'warning' },
        ],
        new Date(tsB),
      );

      const realtimeSummary = [
        { name: 'Revenue', latestValue: 0, unit: 'USD', category: 'revenue', changePercent: 0, periodChangePercent: 0, dataPoints: 1, earliestValue: 0, avgValue: 0, startDate: new Date(), endDate: new Date() },
        { name: 'Bounce Rate', latestValue: 0, unit: '%', category: 'engagement', changePercent: 0, periodChangePercent: 0, dataPoints: 1, earliestValue: 0, avgValue: 0, startDate: new Date(), endDate: new Date() },
        { name: 'Click-Through Rate', latestValue: 0, unit: '%', category: 'engagement', changePercent: 0, periodChangePercent: 0, dataPoints: 1, earliestValue: 0, avgValue: 0, startDate: new Date(), endDate: new Date() },
        { name: 'Churn Rate', latestValue: 0, unit: '%', category: 'retention', changePercent: 0, periodChangePercent: 0, dataPoints: 1, earliestValue: 0, avgValue: 0, startDate: new Date(), endDate: new Date() },
        { name: 'Future Metric', latestValue: 0, unit: 'u', category: 'revenue', changePercent: 0, periodChangePercent: 0, dataPoints: 1, earliestValue: 0, avgValue: 0, startDate: new Date(), endDate: new Date() },
      ];
      (metricsService.getSummary as jest.Mock).mockResolvedValue(realtimeSummary);

      (repo.find as jest.Mock).mockImplementation((opts: any) => {
        if (opts?.where?.batchId === 'batch_A') return Promise.resolve(metricsA);
        if (opts?.where?.batchId === 'batch_B') return Promise.resolve(metricsB);
        return Promise.resolve([]);
      });

      const result = await service.compareSnapshots(tsA, tsB, 'admin');

      const names = result.diffs.map(d => d.metricName).sort();
      expect(names).toEqual([
        'Bounce Rate',
        'Churn Rate',
        'Click-Through Rate',
        'Future Metric',
        'Revenue',
      ]);

      const churn = result.diffs.find(d => d.metricName === 'Churn Rate')!;
      expect(churn.presentInA).toBe(false);
      expect(churn.presentInB).toBe(false);

      const future = result.diffs.find(d => d.metricName === 'Future Metric')!;
      expect(future.presentInA).toBe(false);
      expect(future.presentInB).toBe(false);
    });

    it('数值无变化时 valueDelta=0, valueChangePercent=0, statusChanged=false', async () => {
      setupBatchLookup(repo, {
        tsA: { batchId: 'batch_A', recordedAt: tsA },
        tsB: { batchId: 'batch_B', recordedAt: tsB },
      });

      const metricsA = makeBatchMetrics(
        'batch_A',
        [
          { metricName: 'Revenue', value: 8000, status: 'normal' },
          { metricName: 'Bounce Rate', value: 42, status: 'normal' },
          { metricName: 'Churn Rate', value: 2.1, status: 'normal' },
          { metricName: 'Click-Through Rate', value: 3.0, status: 'normal' },
        ],
        new Date(tsA),
      );

      const metricsB = makeBatchMetrics(
        'batch_B',
        [
          { metricName: 'Revenue', value: 8000, status: 'normal' },
          { metricName: 'Bounce Rate', value: 42, status: 'normal' },
          { metricName: 'Churn Rate', value: 2.1, status: 'normal' },
          { metricName: 'Click-Through Rate', value: 3.0, status: 'normal' },
        ],
        new Date(tsB),
      );

      (repo.find as jest.Mock).mockImplementation((opts: any) => {
        if (opts?.where?.batchId === 'batch_A') return Promise.resolve(metricsA);
        if (opts?.where?.batchId === 'batch_B') return Promise.resolve(metricsB);
        return Promise.resolve([]);
      });

      const result = await service.compareSnapshots(tsA, tsB, 'admin');

      expect(result.summary.metricsWithValueChange).toBe(0);
      expect(result.summary.metricsWithStatusChange).toBe(0);
      for (const d of result.diffs) {
        expect(d.valueDelta).toBe(0);
      }
    });

    it('选择离目标时间戳最近的批次 (前后扫描 24h)', async () => {
      const callLog: any[] = [];
      (repo.createQueryBuilder as jest.Mock).mockImplementation(() => {
        return {
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockImplementation((sql: string) => {
            callLog.push(sql);
            return { mockReturnThis: () => ({}) };
          }).mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          setParameter: jest.fn().mockReturnThis(),
          getRawOne: jest
            .fn()
            .mockResolvedValueOnce({ batchId: 'batch_before_A', recordedAt: tsA })
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ batchId: 'batch_before_B', recordedAt: tsB })
            .mockResolvedValueOnce(null),
          getRawMany: jest.fn().mockResolvedValue([]),
        };
      });

      const fourMetrics = [
        { metricName: 'Revenue', value: 8000, status: 'normal' },
        { metricName: 'Bounce Rate', value: 42, status: 'normal' },
        { metricName: 'Churn Rate', value: 2.1, status: 'normal' },
        { metricName: 'Click-Through Rate', value: 3.0, status: 'normal' },
      ];

      (repo.find as jest.Mock).mockResolvedValue(makeBatchMetrics('batch_X', fourMetrics as any, new Date()));

      const result = await service.compareSnapshots(tsA, tsB, 'admin');

      expect(result.snapshotA.batchId).toBe('batch_before_A');
      expect(result.snapshotB.batchId).toBe('batch_before_B');
    });
  });
});
