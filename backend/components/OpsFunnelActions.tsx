'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function OpsFunnelActions({ funnelId }: { funnelId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<'retry' | 'rollback' | null>(null);
  const [error, setError] = useState('');

  async function run(action: 'retry' | 'rollback') {
    setPending(action);
    setError('');
    try {
      const url = action === 'retry' ? `/api/funnels/${funnelId}/gtm-push` : `/api/funnels/${funnelId}/gtm-rollback`;
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: action === 'retry' ? '{}' : undefined });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? `${action} failed`);
      else router.refresh();
    } catch {
      setError(`${action} failed — network error`);
    } finally {
      setPending(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn" disabled={pending !== null} onClick={() => run('retry')} style={{ fontSize: 10, padding: '6px 10px' }}>
          {pending === 'retry' ? 'Retrying…' : 'Retry'}
        </button>
        <button
          className="btn"
          disabled={pending !== null}
          onClick={() => run('rollback')}
          style={{ fontSize: 10, padding: '6px 10px', borderColor: 'var(--danger)', color: 'var(--danger)' }}
        >
          {pending === 'rollback' ? 'Rolling back…' : 'Roll back'}
        </button>
      </div>
      {error && <span style={{ fontSize: 10, color: 'var(--danger)' }}>{error}</span>}
    </div>
  );
}
