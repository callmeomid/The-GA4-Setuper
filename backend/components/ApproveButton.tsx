'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ApproveButton({ funnelId }: { funnelId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function approve() {
    setPending(true);
    try {
      const res = await fetch(`/api/funnels/${funnelId}/approve`, { method: 'POST' });
      if (res.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button className="btn btn-accent" disabled={pending} onClick={approve}>
      {pending ? 'Approving…' : 'Approve Funnel'}
    </button>
  );
}
