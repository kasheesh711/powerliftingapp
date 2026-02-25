import Link from 'next/link';

export default function HomePage(): JSX.Element {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24
      }}
    >
      <section
        style={{
          width: 'min(760px, 100%)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24,
          display: 'grid',
          gap: 12
        }}
      >
        <h1 style={{ margin: 0 }}>Powerlifting Dashboard Migration</h1>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          App Router target with contract-frozen dashboard APIs and dual backend adapters.
        </p>
        <div>
          <Link href="/dashboard">Open dashboard</Link>
        </div>
      </section>
    </main>
  );
}
