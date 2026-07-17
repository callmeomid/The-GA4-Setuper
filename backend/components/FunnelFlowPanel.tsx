'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FlowDiagram } from '@/components/FlowDiagram';

type Step = React.ComponentProps<typeof FlowDiagram>['steps'][number];

export function FunnelFlowPanel({
  funnelId,
  steps,
  initialApproved,
}: {
  funnelId: string;
  steps: Step[];
  initialApproved: boolean;
}) {
  const router = useRouter();
  const [approved, setApproved] = useState(initialApproved);
  const [pending, setPending] = useState(false);

  async function approve() {
    setPending(true);
    try {
      const res = await fetch(`/api/funnels/${funnelId}/approve`, { method: 'POST' });
      if (res.ok) {
        setApproved(true);
        // let the wiring animation finish before reconciling with the server
        setTimeout(() => router.refresh(), 650);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <FlowDiagram steps={steps} approved={approved} />
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 14 }}>
        {approved ? (
          <>
            <span className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)' }}>
              GA4/Stape generation isn't built yet — GTM setup below only ever touches a draft workspace.
            </span>
            <Link href={`/funnels/${funnelId}/gtm-setup`} className="btn btn-accent" style={{ textDecoration: 'none' }}>
              Set up in Google Tag Manager →
            </Link>
          </>
        ) : (
          <button className="btn btn-accent" disabled={pending} onClick={approve}>
            {pending ? 'Approving…' : 'Approve Funnel'}
          </button>
        )}
      </div>
    </>
  );
}
