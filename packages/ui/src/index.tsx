import type { PropsWithChildren } from 'react';

export function DashboardSection({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <section
      style={{
        border: '1px solid #d0d7de',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        background: '#fff'
      }}
    >
      <h2 style={{ margin: '0 0 12px 0' }}>{title}</h2>
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  delta
}: {
  label: string;
  value: string;
  delta?: string;
}) {
  return (
    <article
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        padding: 12,
        minWidth: 180,
        background: '#fff'
      }}
    >
      <div style={{ color: '#6b7280', fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600 }}>{value}</div>
      {delta ? <div style={{ color: '#1d4ed8', fontSize: 13 }}>{delta}</div> : null}
    </article>
  );
}
