import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginApi, registerApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('viewer');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore(s => s.setAuth);
  const navigate = useNavigate();

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 8,
    color: '#f1f5f9',
    fontSize: 15,
    boxSizing: 'border-box' as const,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = mode === 'login'
        ? await loginApi(username, password)
        : await registerApi(username, password, role);
      setAuth(res.data.access_token, res.data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#0f172a',
      padding: 24,
    }}>
      <div style={{
        background: '#1e293b',
        borderRadius: 16,
        padding: 40,
        width: '100%',
        maxWidth: 420,
        border: '1px solid #334155',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#38bdf8' }}>MarketDash</div>
          <div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>Marketing Data Visualization</div>
        </div>
        <div style={{ display: 'flex', marginBottom: 24, background: '#0f172a', borderRadius: 8, padding: 4 }}>
          {(['login', 'register'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1,
              padding: '8px',
              background: mode === m ? '#38bdf8' : 'transparent',
              border: 'none',
              borderRadius: 6,
              color: mode === m ? '#0f172a' : '#64748b',
              cursor: 'pointer',
              fontWeight: mode === m ? 600 : 400,
              fontSize: 14,
              textTransform: 'capitalize',
            }}>
              {m}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input
            style={inputStyle}
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
          <input
            style={inputStyle}
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {mode === 'register' && (
            <select style={inputStyle} value={role} onChange={e => setRole(e.target.value)}>
              <option value="viewer">Viewer</option>
              <option value="analyst">Analyst</option>
              <option value="admin">Admin</option>
            </select>
          )}
          {error && (
            <div style={{ color: '#f87171', fontSize: 13, padding: '8px 12px', background: 'rgba(248,113,113,0.1)', borderRadius: 6 }}>
              {error}
            </div>
          )}
          <button type="submit" disabled={loading} style={{
            padding: '13px',
            background: '#38bdf8',
            border: 'none',
            borderRadius: 8,
            color: '#0f172a',
            fontWeight: 700,
            fontSize: 15,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
