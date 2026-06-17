import { useState, useEffect } from 'react';
import { getDashboardKpis, getDashboardCharts } from '../api/dashboard';
import KpiCard from '../components/KpiCard';
import RevenueChart from '../components/RevenueChart';
import CategoryChart from '../components/CategoryChart';
import MetricsPieChart from '../components/MetricsPieChart';

export default function DashboardPage() {
  const [kpis, setKpis] = useState<any[]>([]);
  const [charts, setCharts] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboardKpis(), getDashboardCharts()])
      .then(([kpisRes, chartsRes]) => {
        setKpis(kpisRes.data);
        setCharts(chartsRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: '#64748b', fontSize: 16 }}>
        Loading dashboard...
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>Dashboard</h1>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>Marketing performance overview</p>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
        {kpis.map((kpi: any) => (
          <KpiCard
            key={kpi.name}
            name={kpi.name}
            value={kpi.value}
            unit={kpi.unit}
            change={kpi.change}
            trend={kpi.trend}
          />
        ))}
      </div>

      {charts && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <RevenueChart data={charts.revenueData} title="Revenue Trend (7 Days)" color="#38bdf8" />
            <RevenueChart data={charts.visitorData} title="Unique Visitors (7 Days)" color="#4ade80" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <CategoryChart data={charts.categoryData} />
            <MetricsPieChart data={charts.pieData} />
          </div>
        </>
      )}
    </div>
  );
}
