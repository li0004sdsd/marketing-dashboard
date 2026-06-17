import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Metric } from './metric.entity';
import { CreateMetricDto } from './dto/create-metric.dto';

@Injectable()
export class MetricsService implements OnModuleInit {
  constructor(
    @InjectRepository(Metric)
    private repo: Repository<Metric>,
  ) {}

  async onModuleInit() {
    const count = await this.repo.count();
    if (count === 0) {
      await this.seed();
    }
  }

  private async seed() {
    const now = Date.now();
    const metricDefs = [
      { name: 'Page Views', unit: 'views', category: 'acquisition' },
      { name: 'Unique Visitors', unit: 'users', category: 'acquisition' },
      { name: 'Click-Through Rate', unit: '%', category: 'engagement' },
      { name: 'Bounce Rate', unit: '%', category: 'engagement' },
      { name: 'Session Duration', unit: 'sec', category: 'engagement' },
      { name: 'Revenue', unit: 'USD', category: 'revenue' },
      { name: 'Cost Per Click', unit: 'USD', category: 'revenue' },
      { name: 'Return on Ad Spend', unit: 'x', category: 'revenue' },
      { name: 'Customer Retention Rate', unit: '%', category: 'retention' },
      { name: 'Churn Rate', unit: '%', category: 'retention' },
    ];

    for (let day = 29; day >= 0; day--) {
      for (const def of metricDefs) {
        const base: Record<string, number> = {
          'Page Views': 12000,
          'Unique Visitors': 4500,
          'Click-Through Rate': 3.2,
          'Bounce Rate': 42,
          'Session Duration': 185,
          'Revenue': 8500,
          'Cost Per Click': 1.4,
          'Return on Ad Spend': 3.8,
          'Customer Retention Rate': 78,
          'Churn Rate': 2.1,
        };
        const b = base[def.name] ?? 100;
        const value = parseFloat((b * (0.85 + Math.random() * 0.3)).toFixed(2));
        const metric = this.repo.create({
          name: def.name,
          value,
          unit: def.unit,
          category: def.category,
          dataSourceId: 1,
        });
        const d = new Date(now - day * 86400000);
        metric.timestamp = d;
        await this.repo.save(metric);
      }
    }
  }

  findAll() {
    return this.repo.find({ order: { timestamp: 'DESC' }, take: 200 });
  }

  async getSummary() {
    const metrics = await this.repo.find({ order: { timestamp: 'DESC' } });
    const grouped: Record<string, Metric[]> = {};
    for (const m of metrics) {
      if (!grouped[m.name]) grouped[m.name] = [];
      grouped[m.name].push(m);
    }
    return Object.entries(grouped).map(([name, items]) => {
      const sorted = items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const latest = sorted[0];
      const prev = sorted[1];
      const change = prev ? parseFloat(((latest.value - prev.value) / prev.value * 100).toFixed(2)) : 0;
      return {
        name,
        latestValue: latest.value,
        unit: latest.unit,
        category: latest.category,
        changePercent: change,
        dataPoints: sorted.length,
      };
    });
  }

  create(dto: CreateMetricDto) {
    const m = this.repo.create(dto);
    return this.repo.save(m);
  }
}
