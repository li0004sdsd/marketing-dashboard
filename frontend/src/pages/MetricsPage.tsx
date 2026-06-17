import { useState, useEffect } from 'react';
import { getMetricsSummary } from '../api/metrics';

export default function MetricsPage() {
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    getMetricsSummary()
      .then(r => setSummary(r.data))
      .finally(() => setLoading(false));
  }, []);

  const categories = ['all', ...Array.from(new Set(summary.map(s => s.category)))];
  const filtered = filter === 'all' ? summary : summary.filter(s => s.category === filter);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>Marketing Metrics</h1>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>Current metric snapshots with trend data</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)} style={{
            padding: '7px 16px',
            background: filter === cat ? '#38bdf8' : '#1e293b',
            border: '1px solid ' + (filter === cat ? '#38bdf8' : '#334155'),
            borderRadius: 999,
            color: filter === cat ? '#0f172a' : '#94a3b8',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: filter === cat ? 600 : 400,
            textTransform: 'capitalize',
          }}>
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#64748b' }}>Loading...</div>
      ) : (
        <div style={{ background: '#1e293b', borderRadius: 12, border: '1px solid #334155', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0f172a' }}>
                {['Metric', 'Category', 'Latest Value', 'Change', 'Data Points'].map(h => (
                  <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m: any, i: number) => (
                <tr key={m.name} style={{ borderTop: i > 0 ? '1px solid #334155' : 'none' }}>
                  <td style={{ padding: '14px 20px', color: '#f1f5f9', fontWeight: 500 }}>{m.name}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ padding: '3px 10px', background: 'rgba(56,189,248,0.1)', color: '#38bdf8', borderRadius: 999, fontSize: 12, textTransform: 'capitalize' }}>
                      {m.category}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', color: '#f1f5f9' }}>
                    {m.latestValue.toFixed(2)} {m.unit}
                  </td>
                  <td style={{ padding: '14px 20px', color: m.changePercent >= 0 ? '#4ade80' : '#f87171' }}>
                    {m.changePercent >= 0 ? '+' : ''}{m.changePercent.toFixed(2)}%
                  </td>
                  <td style={{ padding: '14px 20px', color: '#64748b' }}>{m.dataPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
