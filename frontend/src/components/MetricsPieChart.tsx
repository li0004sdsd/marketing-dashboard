import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#38bdf8', '#818cf8', '#4ade80', '#fb923c', '#f472b6', '#facc15'];

interface Props {
  data: { name: string; value: number }[];
}

export default function MetricsPieChart({ data }: Props) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 12, padding: 24, border: '1px solid #334155' }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 20 }}>Metrics Distribution</div>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
            {data.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }}
          />
          <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
