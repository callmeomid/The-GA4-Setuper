'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: '0.06em', color: 'var(--line-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div
          className="mono"
          style={{
            flex: 1,
            background: 'var(--bg)',
            border: '1px solid var(--line-ghost)',
            borderRadius: 2,
            padding: '9px 10px',
            fontSize: 12,
            color: 'var(--line-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </div>
        <button className="btn" style={{ fontSize: 10.5, padding: '0 12px' }} onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

export function WaitForFunnel({
  backendUrl,
  apiKey,
  initialCount,
}: {
  backendUrl: string;
  apiKey: string;
  initialCount: number;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const found = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (found.current) return;
      setChecking(true);
      try {
        const res = await fetch('/api/funnels');
        const data = await res.json();
        const funnels: { id: string }[] = data.funnels ?? [];
        if (!cancelled && funnels.length > initialCount && funnels[0]) {
          found.current = true;
          router.push(`/funnels/${funnels[0].id}`);
        }
      } catch {
        // Transient network hiccup — the next tick tries again.
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [initialCount, router]);

  return (
    <div className="panel" style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: '14px 16px', background: 'var(--bg-raised)' }}>
      <CopyField label="Backend URL" value={backendUrl} />
      <CopyField label="API key" value={apiKey} />

      <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--line-secondary)', marginTop: 6 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--line-secondary)',
            opacity: checking ? 1 : 0.4,
            transition: 'opacity 150ms linear',
          }}
        />
        Waiting for your first funnel to arrive…
      </div>
    </div>
  );
}
