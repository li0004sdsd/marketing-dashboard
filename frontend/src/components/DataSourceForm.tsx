import { useState } from 'react';

interface Props {
  initial?: { name: string; type: string; connectionString: string; status: string };
  onSubmit: (data: { name: string; type: string; connectionString: string; status: string }) => void;
  onCancel: () => void;
}

export default function DataSourceForm({ initial, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState(initial?.type ?? 'database');
  const [connectionString, setConnectionString] = useState(initial?.connectionString ?? '');
  const [status, setStatus] = useState(initial?.status ?? 'active');

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 8,
    color: '#f1f5f9',
    fontSize: 14,
    boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Name</label>
        <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Source name" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Type</label>
        <select style={inputStyle} value={type} onChange={e => setType(e.target.value)}>
          <option value="database">Database</option>
          <option value="api">API</option>
          <option value="csv">CSV</option>
          <option value="analytics">Analytics</option>
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Connection String</label>
        <input style={inputStyle} value={connectionString} onChange={e => setConnectionString(e.target.value)} placeholder="Optional" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Status</label>
        <select style={inputStyle} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="error">Error</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid #475569', borderRadius: 8, color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>
          Cancel
        </button>
        <button onClick={() => onSubmit({ name, type, connectionString, status })} style={{ padding: '10px 20px', background: '#38bdf8', border: 'none', borderRadius: 8, color: '#0f172a', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          Save
        </button>
      </div>
    </div>
  );
}
