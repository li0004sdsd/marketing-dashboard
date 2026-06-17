interface KpiCardProps {
  name: string;
  value: number;
  unit: string;
  change: number;
  trend: 'up' | 'down';
}

export default function KpiCard({ name, value, unit, change, trend }: KpiCardProps) {
  const isPositive = trend === 'up';
  const formatted = unit === 'USD'
    ? `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : unit === '%'
    ? `${value.toFixed(1)}%`
    : value.toLocaleString('en-US', { maximumFractionDigits: 1 });

  return (
    <div style={{
      background: '#1e293b',
      borderRadius: 12,
      padding: 24,
      border: '1px solid #334155',
      flex: '1 1 200px',
      minWidth: 200,
    }}>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {name}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>
        {formatted}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
        <span style={{ color: isPositive ? '#4ade80' : '#f87171' }}>
          {isPositive ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
        </span>
        <span style={{ color: '#64748b' }}>vs previous</span>
      </div>
    </div>
  );
}
