'use client';

import { useState } from 'react';

type Step = { id: string; order: number; label: string; ga4Status: string };

function StepCheck({ funnelId, step }: { funnelId: string; step: Step }) {
  const [status, setStatus] = useState(step.ga4Status);
  const [pending, setPending] = useState(false);
  const confirmed = status === 'validated';

  async function toggle() {
    setPending(true);
    try {
      const res = await fetch(`/api/funnels/${funnelId}/validate-ga4`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId: step.id, confirmed: !confirmed }),
      });
      const data = await res.json();
      if (res.ok) setStatus(data.ga4Status);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        width: '100%',
        textAlign: 'left',
        background: 'transparent',
        border: '1px solid var(--line-ghost)',
        borderRadius: 2,
        padding: 12,
        cursor: 'pointer',
        color: 'inherit',
        fontFamily: 'inherit',
      }}
    >
      <span
        style={{
          flex: '0 0 auto',
          width: 13,
          height: 13,
          marginTop: 2,
          borderRadius: 2,
          border: `1px ${confirmed ? 'solid' : 'dashed'} ${confirmed ? 'var(--accent)' : 'var(--line-secondary)'}`,
          background: confirmed ? 'var(--accent)' : 'transparent',
        }}
      />
      <span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--line-secondary)', display: 'block', marginBottom: 2 }}>
          STEP {String(step.order).padStart(2, '0')}
        </span>
        <span style={{ fontSize: 13 }}>{step.label}</span>
      </span>
    </button>
  );
}

export function DebugViewChecklist({ funnelId, steps }: { funnelId: string; steps: Step[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {steps.map((step) => (
        <StepCheck key={step.id} funnelId={funnelId} step={step} />
      ))}
    </div>
  );
}

export function StapeHealthCheck({ funnelId, initialStatus }: { funnelId: string; initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [checking, setChecking] = useState(false);

  async function check() {
    setChecking(true);
    try {
      const res = await fetch(`/api/funnels/${funnelId}/validate-stape`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) setStatus(data.status);
      else setStatus('unreachable');
    } finally {
      setChecking(false);
    }
  }

  const color = status === 'healthy' ? 'var(--accent)' : status === 'unreachable' ? 'var(--danger)' : 'var(--line-secondary)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span
        className="mono"
        style={{ fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase', color, border: `1px solid ${color}`, borderRadius: 2, padding: '3px 8px' }}
      >
        {status}
      </span>
      <button className="btn" disabled={checking} onClick={check}>
        {checking ? 'Checking…' : 'Check now'}
      </button>
    </div>
  );
}
