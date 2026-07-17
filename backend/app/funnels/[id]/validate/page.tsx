'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type StepResult = {
  stepId: string;
  order: number;
  label: string;
  eventName: string | null;
  status: 'pass' | 'fail';
  mpAccepted: boolean;
  mpMessages: string[];
  realtimeConfirmed: boolean;
  bigQueryConfirmed: 'confirmed' | 'not_yet' | 'not_configured';
  detail: string;
};
type Run = { id: string; source: 'ga4_realtime' | 'bigquery'; overallPass: boolean; createdAt: string; steps: StepResult[] };

function Connector({ status }: { status: 'pending' | 'pass' | 'fail' }) {
  const color = status === 'pass' ? 'var(--accent)' : status === 'fail' ? 'var(--danger)' : 'var(--line-ghost)';
  return (
    <div
      key={status}
      className={status === 'pass' ? 'confirm-pulse' : status === 'fail' ? 'confirm-pulse-danger' : undefined}
      style={{ flex: '0 0 28px', alignSelf: 'center', height: 0, borderTop: `1px ${status === 'pending' ? 'dashed' : 'solid'} ${color}` }}
    />
  );
}

function StepNode({ result }: { result: StepResult | null; }) {
  const status: 'pending' | 'pass' | 'fail' = !result ? 'pending' : result.status;
  const color = status === 'pass' ? 'var(--accent)' : status === 'fail' ? 'var(--danger)' : 'var(--line-ghost)';
  return (
    <div
      key={status}
      className={status === 'pass' ? 'confirm-pulse' : status === 'fail' ? 'confirm-pulse-danger' : undefined}
      style={{ width: 26, height: 26, flex: '0 0 26px', borderRadius: '50%', border: `1px ${status === 'pending' ? 'dashed' : 'solid'} ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <span className="mono" style={{ fontSize: 11, color }}>
        {status === 'pass' ? '✓' : status === 'fail' ? '✕' : '·'}
      </span>
    </div>
  );
}

export default function ValidatePage({ params }: { params: { id: string } }) {
  const [run, setRun] = useState<Run | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/funnels/${params.id}/validate`)
      .then((r) => r.json())
      .then((data) => setRun(data.run))
      .finally(() => setLoaded(true));
  }, [params.id]);

  async function runValidation() {
    setRunning(true);
    setError('');
    try {
      const res = await fetch(`/api/funnels/${params.id}/validate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? 'Validation failed to run.');
      else setRun({ ...data, createdAt: new Date().toISOString() });
    } catch {
      setError('Validation failed to run — network error.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <main style={{ maxWidth: 780, margin: '0 auto', padding: '32px 20px' }}>
      <Link href={`/funnels/${params.id}`} className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
        &larr; Back to funnel
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginTop: 16, marginBottom: 4 }}>Validate</h1>
      <p style={{ fontSize: 13, color: 'var(--line-secondary)', marginTop: 0, marginBottom: 20 }}>
        Fires one real Measurement Protocol test event per step (tagged{' '}
        <span className="mono">debug_mode</span>) and confirms it landed via GA4 Realtime{run?.source === 'bigquery' ? ' and the linked BigQuery export' : ''}. A pass here means data is actually flowing, not just that setup finished.
      </p>

      {error && <div style={{ border: '1px solid var(--danger)', borderRadius: 2, padding: 14, fontSize: 13, color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}

      <div style={{ marginBottom: 20 }}>
        <button className="btn btn-accent" disabled={running} onClick={runValidation}>
          {running ? 'Firing test events…' : run ? 'Run again' : 'Run validation'}
        </button>
      </div>

      {loaded && run && (
        <>
          <div
            className="dot-grid"
            style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', padding: '16px 4px', marginBottom: 20 }}
          >
            {run.steps.map((s, i) => (
              <div key={s.stepId} style={{ display: 'flex', alignItems: 'center' }}>
                <StepNode result={s} />
                {i < run.steps.length - 1 && <Connector status={s.status === 'pass' ? 'pass' : 'fail'} />}
              </div>
            ))}
          </div>

          <div
            style={{
              border: `1px solid ${run.overallPass ? 'var(--accent)' : 'var(--danger)'}`,
              borderRadius: 2,
              padding: 12,
              marginBottom: 16,
              fontSize: 13,
              color: run.overallPass ? 'var(--accent)' : 'var(--danger)',
            }}
          >
            {run.overallPass ? '✓ All steps confirmed landing in GA4.' : '✕ Not every step confirmed — see detail below.'}
            <span className="mono" style={{ fontSize: 10, color: 'var(--line-secondary)', display: 'block', marginTop: 4 }}>
              run {new Date(run.createdAt).toLocaleString()} · source: {run.source === 'bigquery' ? 'GA4 Realtime + BigQuery' : 'GA4 Realtime'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {run.steps.map((s) => (
              <div
                key={s.stepId}
                style={{ border: `1px solid ${s.status === 'pass' ? 'var(--accent)' : 'var(--danger)'}`, borderRadius: 2, padding: 14 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--line-secondary)' }}>
                    STEP {String(s.order).padStart(2, '0')}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 9,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      color: s.status === 'pass' ? 'var(--accent)' : 'var(--danger)',
                      border: `1px solid ${s.status === 'pass' ? 'var(--accent)' : 'var(--danger)'}`,
                      borderRadius: 2,
                      padding: '2px 6px',
                    }}
                  >
                    {s.status}
                  </span>
                </div>
                <div style={{ fontSize: 13.5, marginBottom: 6 }}>{s.label}</div>
                {s.eventName && (
                  <div className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', marginBottom: 6 }}>
                    event: {s.eventName}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, fontSize: 10.5, color: 'var(--line-secondary)', marginBottom: 6 }}>
                  <span>MP accepted: {s.mpAccepted ? 'yes' : 'no'}</span>
                  <span>Realtime: {s.realtimeConfirmed ? 'confirmed' : 'not seen'}</span>
                  <span>
                    BigQuery: {s.bigQueryConfirmed === 'confirmed' ? 'confirmed' : s.bigQueryConfirmed === 'not_yet' ? 'not yet' : 'not configured'}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--line-secondary)', margin: 0 }}>{s.detail}</p>
                {s.mpMessages.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    {s.mpMessages.map((m, i) => (
                      <div key={i} style={{ fontSize: 11, color: 'var(--danger)' }}>
                        ⚠ {m}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {loaded && !run && !running && (
        <div className="dot-grid" style={{ border: '1px dashed var(--line-ghost)', borderRadius: 2, padding: 20, fontSize: 13, color: 'var(--line-secondary)' }}>
          No validation run yet. This needs GA4 setup done first (a data stream and, ideally, GTM/GA4 pushed so each
          step has an event name).
        </div>
      )}
    </main>
  );
}
