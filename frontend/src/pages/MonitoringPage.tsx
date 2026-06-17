import { useState, useEffect, useRef } from 'react';
import { getRealtimeMonitoring, getAlerts } from '../api/monitoring';
import AlertBadge from '../components/AlertBadge';

export default function MonitoringPage() {
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = async () => {
    try {
      const [rtRes, alertRes] = await Promise.all([getRealtimeMonitoring(), getAlerts()]);
      setSnapshots(rtRes.data);
      setAlerts(alertRes.data);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, 15000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>Real-Time Monitoring</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
            Auto-refreshes every 15s · Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <button onClick={refresh} style={{
          padding: '9px 18px',
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 8,
          color: '#38bdf8',
          cursor: 'pointer',
          fontSize: 14,
        }}>
          Refresh Now
        </button>
      </div>

      {alerts.length > 0 && (
        <div style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: 16, marginBottom: 24 }}>
          <div style={{ fontWeight: 600, color: '#f87171', marginBottom: 10, fontSize: 14 }}>
            Active Alerts ({alerts.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alerts.map((a: any) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: '#f1f5f9' }}>
                <AlertBadge status={a.status} />
                <span>{a.metricName}: <strong>{a.value.toFixed(2)}</strong> {a.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: '#64748b' }}>Loading...</div>
      ) : (
        <div style={{ background: '#1e293b', borderRadius: 12, border: '1px solid #334155', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0f172a' }}>
                {['Metric', 'Current Value', 'Status', 'Recorded At'].map(h => (
                  <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s: any, i: number) => (
                <tr key={s.id} style={{ borderTop: i > 0 ? '1px solid #334155' : 'none' }}>
                  <td style={{ padding: '14px 20px', color: '#f1f5f9', fontWeight: 500 }}>{s.metricName}</td>
                  <td style={{ padding: '14px 20px', color: '#f1f5f9' }}>{s.value.toFixed(2)} {s.unit}</td>
                  <td style={{ padding: '14px 20px' }}><AlertBadge status={s.status} /></td>
                  <td style={{ padding: '14px 20px', color: '#64748b', fontSize: 13 }}>
                    {new Date(s.recordedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
