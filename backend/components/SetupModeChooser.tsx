'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Mode = 'client' | 'server';

const OPTIONS: Array<{
  mode: Mode;
  name: string;
  systems: string;
  desc: string;
  tradeoff: string;
}> = [
  {
    mode: 'client',
    name: 'Client-side',
    systems: 'GTM + GA4',
    desc: "Tags fire straight from the visitor's browser to Google's collection endpoint. Faster to set up — fine for most small sites.",
    tradeoff: 'Ad blockers and Safari/iOS tracking limits will quietly drop some events. No server container to maintain.',
  },
  {
    mode: 'server',
    name: 'Server-side',
    systems: 'GTM + GA4 + Stape.io',
    desc: 'Tags route through a server container (hosted by Stape.io) before reaching Google.',
    tradeoff:
      'Recovers events lost to ad blockers and iOS restrictions, and gives more accurate cross-subdomain tracking — at the cost of a subdomain + cookie config to set up and keep running.',
  },
];

export function SetupModeChooser({ funnelId, currentMode }: { funnelId: string; currentMode: Mode | null }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Mode | null>(currentMode);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    if (!selected) return;
    setPending(true);
    setError('');
    try {
      const res = await fetch(`/api/funnels/${funnelId}/setup-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupMode: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not save your choice.');
        return;
      }
      router.push(`/funnels/${funnelId}/gtm-setup`);
    } finally {
      setPending(false);
    }
  }

  const buttonLabel =
    !selected
      ? 'Choose a setup path'
      : selected === currentMode
        ? 'Continue to setup →'
        : currentMode
          ? `Switch to ${selected === 'server' ? 'server-side' : 'client-side'} →`
          : 'Continue to setup →';

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {OPTIONS.map((opt) => {
          const isSelected = selected === opt.mode;
          const isCurrent = currentMode === opt.mode;
          return (
            <button
              key={opt.mode}
              type="button"
              onClick={() => setSelected(opt.mode)}
              style={{
                textAlign: 'left',
                cursor: 'pointer',
                border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--line-ghost)'}`,
                background: isSelected ? 'var(--accent-dim)' : 'transparent',
                borderRadius: 2,
                padding: 18,
                position: 'relative',
                fontFamily: 'inherit',
                color: 'inherit',
              }}
            >
              {isCurrent && (
                <span
                  className="mono"
                  style={{
                    position: 'absolute',
                    top: 18,
                    right: 18,
                    fontSize: 9,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'var(--line-secondary)',
                    border: '1px solid var(--line-ghost)',
                    borderRadius: 2,
                    padding: '2px 6px',
                  }}
                >
                  current
                </span>
              )}
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, paddingRight: isCurrent ? 56 : 0 }}>
                {opt.name}
                <span className="mono" style={{ display: 'block', fontWeight: 400, fontSize: 11, color: 'var(--line-secondary)', marginTop: 3 }}>
                  {opt.systems}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--line-secondary)', lineHeight: 1.55, margin: '10px 0 0' }}>{opt.desc}</p>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--line-ghost)', fontSize: 11.5, color: 'var(--line-secondary)', lineHeight: 1.55 }}>
                {opt.tradeoff}
              </div>
            </button>
          );
        })}
      </div>

      {error && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 12 }}>{error}</div>}

      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-accent" disabled={!selected || pending} onClick={confirm}>
          {pending ? 'Saving…' : buttonLabel}
        </button>
      </div>
    </div>
  );
}
