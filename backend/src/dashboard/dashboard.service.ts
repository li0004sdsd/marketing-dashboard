import { Injectable } from '@nestjs/common';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class DashboardService {
  constructor(private metricsService: MetricsService) {}

  async getKpis() {
    const summary = await this.metricsService.getSummary();
    const keyMetrics = ['Revenue', 'Page Views', 'Click-Through Rate', 'Customer Retention Rate'];
    return summary
      .filter(s => keyMetrics.includes(s.name))
      .map(s => ({
        name: s.name,
        value: s.latestValue,
        unit: s.unit,
        change: s.changePercent,
        trend: s.changePercent >= 0 ? 'up' : 'down',
        category: s.category,
      }));
  }

  async getCharts() {
    const all = await this.metricsService.findAll();
    const last7Days = new Date(Date.now() - 7 * 86400000);

    const revenueData = all
      .filter(m => m.name === 'Revenue' && new Date(m.timestamp) >= last7Days)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(m => ({
        date: new Date(m.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: m.value,
      }));

    const visitorData = all
      .filter(m => m.name === 'Unique Visitors' && new Date(m.timestamp) >= last7Days)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(m => ({
        date: new Date(m.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: m.value,
      }));

    const summary = await this.metricsService.getSummary();
    const categoryData = ['acquisition', 'engagement', 'revenue', 'retention'].map(cat => {
      const items = summary.filter(s => s.category === cat);
      const avg = items.length ? items.reduce((acc, i) => acc + i.latestValue, 0) / items.length : 0;
      return { category: cat, avgValue: parseFloat(avg.toFixed(2)), count: items.length };
    });

    const pieData = summary.map(s => ({
      name: s.name,
      value: Math.abs(s.latestValue),
    })).slice(0, 6);

    return { revenueData, visitorData, categoryData, pieData };
  }
}
