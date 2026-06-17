import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/data-sources', label: 'Data Sources', icon: '🗄️' },
  { path: '/metrics', label: 'Metrics', icon: '📈' },
  { path: '/monitoring', label: 'Monitoring', icon: '🔍' },
];

export default function Layout() {
  const logout = useAuthStore(s => s.logout);
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0f172a', color: '#e2e8f0' }}>
      <aside style={{
        width: 240,
        background: '#1e293b',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 0',
        borderRight: '1px solid #334155',
      }}>
        <div style={{ padding: '0 24px 24px', borderBottom: '1px solid #334155' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#38bdf8' }}>MarketDash</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{user?.username}</div>
        </div>
        <nav style={{ flex: 1, padding: '16px 0' }}>
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 24px',
                color: location.pathname === item.path ? '#38bdf8' : '#94a3b8',
                textDecoration: 'none',
                background: location.pathname === item.path ? 'rgba(56,189,248,0.1)' : 'transparent',
                borderLeft: location.pathname === item.path ? '3px solid #38bdf8' : '3px solid transparent',
                fontSize: 14,
                transition: 'all 0.2s',
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #334155' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '10px',
              background: 'transparent',
              border: '1px solid #475569',
              borderRadius: 8,
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Logout
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, overflow: 'auto', padding: 32 }}>
        <Outlet />
      </main>
    </div>
  );
}
