'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function DeleteFunnelButton({ funnelId, redirectTo }: { funnelId: string; redirectTo?: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    try {
      const res = await fetch(`/api/funnels/${funnelId}`, { method: 'DELETE' });
      if (res.ok) {
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      }
    } finally {
      setPending(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
        <span className="mono" style={{ fontSize: 10.5, color: 'var(--danger)' }}>
          Delete?
        </span>
        <button
          className="btn"
          style={{ padding: '4px 8px', fontSize: 10.5, color: 'var(--danger)', borderColor: 'var(--danger)' }}
          disabled={pending}
          onClick={remove}
        >
          {pending ? 'Deleting…' : 'Confirm'}
        </button>
        <button className="btn" style={{ padding: '4px 8px', fontSize: 10.5 }} disabled={pending} onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      className="btn"
      style={{ padding: '4px 8px', fontSize: 10.5, color: 'var(--danger)', borderColor: 'var(--danger)' }}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        setConfirming(true);
      }}
    >
      Delete
    </button>
  );
}
