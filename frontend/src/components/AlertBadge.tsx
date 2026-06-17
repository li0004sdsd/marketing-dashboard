interface Props {
  status: 'normal' | 'warning' | 'critical';
}

const config = {
  normal: { label: 'Normal', color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
  warning: { label: 'Warning', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
  critical: { label: 'Critical', color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
};

export default function AlertBadge({ status }: Props) {
  const c = config[status] || config.normal;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      color: c.color,
      background: c.bg,
      border: `1px solid ${c.color}33`,
      textTransform: 'uppercase',
    }}>
      {c.label}
    </span>
  );
}
