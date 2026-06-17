import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  data: { date: string; value: number }[];
  title: string;
  color?: string;
}

export default function RevenueChart({ data, title, color = '#38bdf8' }: Props) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 12, padding: 24, border: '1px solid #334155' }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 20 }}>{title}</div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 12 }} />
          <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }}
          />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} name="Value" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
