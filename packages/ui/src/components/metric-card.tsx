import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  detail?: string;
  accent?: ReactNode;
}

export function MetricCard({ label, value, detail, accent }: MetricCardProps): JSX.Element {
  return (
    <article
      style={{
        border: '1px solid #d0d7de',
        borderRadius: 10,
        padding: 14,
        background: '#ffffff',
        display: 'grid',
        gap: 8
      }}
    >
      <div style={{ fontSize: 12, color: '#59636e', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{value}</div>
      {detail ? <div style={{ fontSize: 12, color: '#475569' }}>{detail}</div> : null}
      {accent || null}
    </article>
  );
}
