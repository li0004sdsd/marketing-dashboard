import { Injectable } from '@nestjs/common';
import { MetricsService } from '../metrics/metrics.service';
import { QueryMetricsDto } from '../metrics/dto/query-metrics.dto';
import { getAllowedCategories } from '../metrics/metrics-permission';

@Injectable()
export class DashboardService {
  constructor(private metricsService: MetricsService) {}

  async getKpis(days: number = 30, role: string) {
    const startDate = new Date(Date.now() - days * 86400000).toISOString();
    const allowedCategories = getAllowedCategories(role);
    const query: QueryMetricsDto = {
      startDate,
      names: ['Revenue', 'Page Views', 'Click-Through Rate', 'Customer Retention Rate'],
    };
    const summary = await this.metricsService.getSummary(query, role);
    return summary
      .filter(s => allowedCategories.includes(s.category))
      .map(s => ({
        name: s.name,
        value: s.latestValue,
        unit: s.unit,
        change: s.periodChangePercent,
        trend: s.periodChangePercent >= 0 ? 'up' : 'down',
        category: s.category,
      }));
  }

  async getCharts(days: number = 7, role: string) {
    const startDate = new Date(Date.now() - days * 86400000).toISOString();
    const allowedCategories = getAllowedCategories(role);

    const revenueQuery: QueryMetricsDto = { startDate, names: ['Revenue'] };
    const visitorQuery: QueryMetricsDto = { startDate, names: ['Unique Visitors'] };

    const [revenueMetrics, visitorMetrics, summary] = await Promise.all([
      this.metricsService.findByQuery(revenueQuery, role),
      this.metricsService.findByQuery(visitorQuery, role),
      this.metricsService.getSummary({ startDate }, role),
    ]);

    const revenueData = revenueMetrics.map(m => ({
      date: new Date(m.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: m.value,
    }));

    const visitorData = visitorMetrics.map(m => ({
      date: new Date(m.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: m.value,
    }));

    const filteredSummary = summary.filter(s => allowedCategories.includes(s.category));

    const categoryData = allowedCategories.map(cat => {
      const items = filteredSummary.filter(s => s.category === cat);
      const avg = items.length ? items.reduce((acc, i) => acc + i.latestValue, 0) / items.length : 0;
      return { category: cat, avgValue: parseFloat(avg.toFixed(2)), count: items.length };
    });

    const pieData = filteredSummary.map(s => ({
      name: s.name,
      value: Math.abs(s.latestValue),
    })).slice(0, 6);

    return { revenueData, visitorData, categoryData, pieData };
  }
}
