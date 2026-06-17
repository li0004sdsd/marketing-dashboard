import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  data: { category: string; avgValue: number; count: number }[];
}

export default function CategoryChart({ data }: Props) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 12, padding: 24, border: '1px solid #334155' }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 20 }}>Metrics by Category</div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="category" stroke="#64748b" tick={{ fontSize: 12 }} />
          <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }}
          />
          <Bar dataKey="avgValue" fill="#818cf8" radius={[4, 4, 0, 0]} name="Avg Value" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
