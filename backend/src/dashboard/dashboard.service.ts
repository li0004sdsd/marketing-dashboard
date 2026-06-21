import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Metric } from '../metrics/metric.entity';
import { getAllowedCategories } from '../metrics/metrics-permission';

interface KpiRow {
  name: string;
  value: number;
  unit: string | null;
  category: string;
  earliest_value: number | null;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Metric)
    private readonly metricRepo: Repository<Metric>,
  ) {}

  async getKpis(days: number = 30, role: string) {
    const start = new Date(Date.now() - days * 86400000);
    const end = new Date();
    const allowedCategories = getAllowedCategories(role);
    const kpiNames = ['Revenue', 'Page Views', 'Click-Through Rate', 'Customer Retention Rate'];

    const qb = this.metricRepo.createQueryBuilder('m');
    const rows = await qb
      .select([
        'm.name AS name',
        'm.value AS value',
        'm.unit AS unit',
        'm.category AS category',
      ])
      .addSelect(
        '(SELECT sub.value FROM metrics sub ' +
        'WHERE sub.name = m.name ' +
        'AND sub.timestamp BETWEEN :start AND :end ' +
        'AND sub.category IN (:...cats) ' +
        'ORDER BY sub.timestamp ASC LIMIT 1)',
        'earliest_value',
      )
      .where('m.timestamp BETWEEN :start AND :end')
      .andWhere('m.name IN (:...names)')
      .andWhere('m.category IN (:...cats)')
      .andWhere(
        'm.timestamp = (' +
          'SELECT MAX(sub2.timestamp) FROM metrics sub2 ' +
          'WHERE sub2.name = m.name ' +
          'AND sub2.timestamp BETWEEN :start AND :end ' +
          'AND sub2.category IN (:...cats))',
      )
      .setParameter('start', start)
      .setParameter('end', end)
      .setParameter('names', kpiNames)
      .setParameter('cats', allowedCategories)
      .groupBy('m.name')
      .getRawMany<KpiRow>();

    return rows.map(r => {
      const latestValue = Number(r.value);
      const earliestValue = Number(r.earliest_value ?? 0);
      const periodChange = earliestValue !== 0
        ? parseFloat(((latestValue - earliestValue) / earliestValue * 100).toFixed(2))
        : 0;
      return {
        name: r.name,
        value: latestValue,
        unit: r.unit ?? '',
        change: periodChange,
        trend: periodChange >= 0 ? 'up' : 'down',
        category: r.category,
      };
    });
  }

  async getCharts(days: number = 7, role: string) {
    const start = new Date(Date.now() - days * 86400000);
    const end = new Date();
    const allowedCategories = getAllowedCategories(role);

    const tsNames = ['Revenue', 'Unique Visitors'];

    const tsQb = this.metricRepo.createQueryBuilder('m');
    const latestQb = this.metricRepo.createQueryBuilder('m');

    const timeSeriesPromise = tsQb
      .select('m.name', 'name')
      .addSelect('m.value', 'value')
      .addSelect('m.timestamp', 'timestamp')
      .where('m.timestamp BETWEEN :start AND :end')
      .andWhere('m.name IN (:...names)')
      .andWhere('m.category IN (:...cats)')
      .orderBy('m.timestamp', 'ASC')
      .setParameter('start', start)
      .setParameter('end', end)
      .setParameter('names', tsNames)
      .setParameter('cats', allowedCategories)
      .getRawMany<{ name: string; value: number; timestamp: string }>();

    const latestPerMetricPromise = latestQb
      .select('m.name', 'name')
      .addSelect('m.value', 'value')
      .addSelect('m.unit', 'unit')
      .addSelect('m.category', 'category')
      .where('m.timestamp BETWEEN :start AND :end')
      .andWhere('m.category IN (:...cats)')
      .andWhere(
        'm.timestamp = (SELECT MAX(sub.timestamp) FROM metrics sub ' +
          'WHERE sub.name = m.name ' +
          'AND sub.timestamp BETWEEN :start AND :end ' +
          'AND sub.category IN (:...cats))',
      )
      .setParameter('start', start)
      .setParameter('end', end)
      .setParameter('cats', allowedCategories)
      .groupBy('m.name')
      .getRawMany<{ name: string; value: number; unit: string | null; category: string }>();

    const [timeSeries, latestRows] = await Promise.all([
      timeSeriesPromise,
      latestPerMetricPromise,
    ]);

    const revenueData: { date: string; value: number }[] = [];
    const visitorData: { date: string; value: number }[] = [];

    for (const row of timeSeries) {
      const d = new Date(row.timestamp);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (row.name === 'Revenue') {
        revenueData.push({ date: dateStr, value: Number(row.value) });
      } else if (row.name === 'Unique Visitors') {
        visitorData.push({ date: dateStr, value: Number(row.value) });
      }
    }

    const categoryData = allowedCategories.map(cat => {
      const items = latestRows.filter(r => r.category === cat);
      const sum = items.reduce((acc, i) => acc + Number(i.value), 0);
      const avg = items.length ? sum / items.length : 0;
      return {
        category: cat,
        avgValue: parseFloat(avg.toFixed(2)),
        count: items.length,
      };
    });

    const pieData = latestRows.map(r => ({
      name: r.name,
      value: Math.abs(Number(r.value)),
    }));

    return { revenueData, visitorData, categoryData, pieData };
  }
}
