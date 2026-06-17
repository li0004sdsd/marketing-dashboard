import { useState, useEffect } from 'react';
import { getDataSources, createDataSource, updateDataSource, deleteDataSource } from '../api/dataSources';
import DataSourceForm from '../components/DataSourceForm';

export default function DataSourcesPage() {
  const [sources, setSources] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getDataSources()
      .then(r => setSources(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data: any) => {
    await createDataSource(data);
    setShowForm(false);
    load();
  };

  const handleUpdate = async (data: any) => {
    await updateDataSource(editing.id, data);
    setEditing(null);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this data source?')) return;
    await deleteDataSource(id);
    load();
  };

  const statusColor: Record<string, string> = {
    active: '#4ade80',
    inactive: '#64748b',
    error: '#f87171',
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>Data Sources</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>Manage your connected data sources</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{
          padding: '10px 20px',
          background: '#38bdf8',
          border: 'none',
          borderRadius: 8,
          color: '#0f172a',
          fontWeight: 600,
          cursor: 'pointer',
          fontSize: 14,
        }}>
          + Add Source
        </button>
      </div>

      {(showForm || editing) && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{ background: '#1e293b', borderRadius: 12, padding: 32, width: 480, border: '1px solid #334155' }}>
            <h2 style={{ margin: '0 0 24px', color: '#f1f5f9', fontSize: 18 }}>
              {editing ? 'Edit Data Source' : 'Add Data Source'}
            </h2>
            <DataSourceForm
              initial={editing}
              onSubmit={editing ? handleUpdate : handleCreate}
              onCancel={() => { setShowForm(false); setEditing(null); }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: '#64748b' }}>Loading...</div>
      ) : sources.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#64748b', padding: 48 }}>No data sources yet. Add one to get started.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sources.map((src: any) => (
            <div key={src.id} style={{
              background: '#1e293b',
              borderRadius: 10,
              padding: '16px 20px',
              border: '1px solid #334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>{src.name}</div>
                <div style={{ fontSize: 13, color: '#64748b' }}>{src.type}{src.connectionString ? ` · ${src.connectionString}` : ''}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: statusColor[src.status] || '#64748b', fontSize: 13 }}>● {src.status}</span>
                <button onClick={() => setEditing(src)} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #475569', borderRadius: 6, color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>Edit</button>
                <button onClick={() => handleDelete(src.id)} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #475569', borderRadius: 6, color: '#f87171', cursor: 'pointer', fontSize: 13 }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
