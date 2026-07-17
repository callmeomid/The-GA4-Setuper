'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Method = 'bigquery' | 'realtime' | 'debugview';
type Stream = { name: string; measurementId?: string; displayName?: string };
type StepResult = { id: string; stepId: string; label: string; eventName: string; outcome: string; detail: string | null; checkedAt: string | null };
type Run = { id: string; method: string; createdAt: string; results: StepResult[] };

const METHOD_OPTIONS: { value: Method; label: string; description: string }[] = [
  { value: 'bigquery', label: 'BigQuery export', description: 'Fully automated, matches the exact test event via a correlation id.' },
  { value: 'realtime', label: 'GA4 Data API (realtime)', description: 'Automated but coarser — checks if the event name showed up at all in the last 30 min.' },
  { value: 'debugview', label: 'DebugView (manual)', description: 'No public API — opens DebugView and you confirm each step by eye.' },
];

function OutcomeBadge({ outcome }: { outcome: string }) {
  const color = outcome === 'pass' ? 'var(--accent)' : outcome === 'fail' || outcome === 'error' ? 'var(--danger)' : 'var(--line-secondary)';
  const border = outcome === 'pending' || outcome === 'pending_manual' ? 'dashed' : 'solid';
  return (
    <span
      className="mono"
      style={{ fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase', color, border: `1px ${border} ${color}`, borderRadius: 2, padding: '2px 6px' }}
    >
      {outcome.replace('_', ' ')}
    </span>
  );
}

export default function ValidatePage({ params }: { params: { id: string } }) {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [debugUrl, setDebugUrl] = useState('');
  const [loadError, setLoadError] = useState('');

  const [method, setMethod] = useState<Method>('bigquery');
  const [streamName, setStreamName] = useState('');
  const [bqProjectId, setBqProjectId] = useState('');
  const [bqDatasetId, setBqDatasetId] = useState('');

  const [firing, setFiring] = useState(false);
  const [fireError, setFireError] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetch(`/api/funnels/${params.id}/validate`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setLoadError(data.error);
        else {
          setStreams(data.streams ?? []);
          if (data.streams?.length === 1) setStreamName(data.streams[0].name);
          setRuns(data.runs ?? []);
          setDebugUrl(data.debugViewUrl ?? '');
          if (data.funnel?.validationMethod) setMethod(data.funnel.validationMethod);
          if (data.funnel?.bigQueryProjectId) setBqProjectId(data.funnel.bigQueryProjectId);
          if (data.funnel?.bigQueryDatasetId) setBqDatasetId(data.funnel.bigQueryDatasetId);
        }
      })
      .catch(() => setLoadError('Could not load validation setup.'));
  }, [params.id]);

  const selectedStream = streams.find((s) => s.name === streamName);
  const latestRun = runs[0];

  async function fire() {
    if (!streamName || !selectedStream?.measurementId) return;
    setFiring(true);
    setFireError('');
    try {
      const res = await fetch(`/api/funnels/${params.id}/validate/fire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          streamName,
          measurementId: selectedStream.measurementId,
          bigQueryProjectId: method === 'bigquery' ? bqProjectId : undefined,
          bigQueryDatasetId: method === 'bigquery' ? bqDatasetId || undefined : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) setFireError(data.error ?? 'Could not fire test events.');
      else setRuns((prev) => [data.run, ...prev]);
    } catch {
      setFireError('Could not fire test events — network error.');
    } finally {
      setFiring(false);
    }
  }

  async function checkAgain(runId: string) {
    setChecking(true);
    try {
      const res = await fetch(`/api/funnels/${params.id}/validate/${runId}/check`);
      const data = await res.json();
      if (res.ok) setRuns((prev) => prev.map((r) => (r.id === runId ? data.run : r)));
    } finally {
      setChecking(false);
    }
  }

  async function markManual(runId: string, stepResultId: string, outcome: 'pass' | 'fail') {
    const res = await fetch(`/api/funnels/${params.id}/validate/${runId}/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepResultId, outcome }),
    });
    if (res.ok) {
      setRuns((prev) =>
        prev.map((r) =>
          r.id === runId
            ? { ...r, results: r.results.map((res2) => (res2.id === stepResultId ? { ...res2, outcome, detail: 'Manually confirmed in GA4 DebugView.' } : res2)) }
            : r,
        ),
      );
    }
  }

  const canFire = Boolean(streamName && selectedStream?.measurementId) && (method !== 'bigquery' || bqProjectId);

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px' }}>
      <Link href={`/funnels/${params.id}`} className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
        &larr; Back to funnel
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginTop: 16, marginBottom: 4 }}>Validate</h1>
      <p style={{ fontSize: 13, color: 'var(--line-secondary)', marginTop: 0, marginBottom: 20 }}>
        Fires a real test event through GA4's Measurement Protocol for every step, tagged <span className="mono">debug_mode</span>, then
        confirms each one landed. Delivery isn't instant — BigQuery's streaming buffer and realtime reporting both lag a little,
        so pending steps may need a "Check again".
      </p>

      {loadError && (
        <div style={{ border: '1px solid var(--danger)', borderRadius: 2, padding: 14, fontSize: 13, color: 'var(--danger)' }}>
          {loadError}{' '}
          {loadError.includes('Settings') && (
            <Link href="/settings" style={{ color: 'var(--danger)', textDecoration: 'underline' }}>
              Go to Settings
            </Link>
          )}
        </div>
      )}

      {!loadError && streams.length === 0 && (
        <div className="dot-grid" style={{ border: '1px dashed var(--line-ghost)', borderRadius: 2, padding: 20, fontSize: 13, color: 'var(--line-secondary)' }}>
          Loading GA4 web data streams…
        </div>
      )}

      {streams.length > 0 && (
        <>
          <div style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 14, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13 }}>Data stream</div>
            <select
              value={streamName}
              onChange={(e) => setStreamName(e.target.value)}
              style={{ background: 'var(--bg)', color: 'var(--line-primary)', border: '1px solid var(--line-ghost)', padding: 8, borderRadius: 2 }}
            >
              <option value="">Select stream…</option>
              {streams.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.displayName} ({s.measurementId})
                </option>
              ))}
            </select>

            <div style={{ fontSize: 13, marginTop: 6 }}>Validation method</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {METHOD_OPTIONS.map((opt) => (
                <label key={opt.value} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input type="radio" name="method" checked={method === opt.value} onChange={() => setMethod(opt.value)} style={{ marginTop: 3 }} />
                  <span>
                    <span style={{ fontSize: 13 }}>{opt.label}</span>
                    <br />
                    <span style={{ fontSize: 11.5, color: 'var(--line-secondary)' }}>{opt.description}</span>
                  </span>
                </label>
              ))}
            </div>

            {method === 'bigquery' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <input
                  value={bqProjectId}
                  onChange={(e) => setBqProjectId(e.target.value)}
                  placeholder="BigQuery project ID"
                  className="mono"
                  style={{ background: 'var(--bg)', color: 'var(--line-primary)', border: '1px solid var(--line-ghost)', padding: 8, borderRadius: 2 }}
                />
                <input
                  value={bqDatasetId}
                  onChange={(e) => setBqDatasetId(e.target.value)}
                  placeholder="Dataset (optional — defaults to analytics_<property id>)"
                  className="mono"
                  style={{ background: 'var(--bg)', color: 'var(--line-primary)', border: '1px solid var(--line-ghost)', padding: 8, borderRadius: 2 }}
                />
              </div>
            )}

            {method === 'debugview' && debugUrl && (
              <a href={debugUrl} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)' }}>
                Open GA4 DebugView →
              </a>
            )}
          </div>

          {fireError && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 12 }}>{fireError}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <button className="btn btn-accent" disabled={firing || !canFire} onClick={fire}>
              {firing ? 'Firing…' : 'Fire test events'}
            </button>
          </div>
        </>
      )}

      {latestRun && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--line-secondary)' }}>
              Run fired {new Date(latestRun.createdAt).toLocaleTimeString()} · {latestRun.method}
            </span>
            {(latestRun.method === 'bigquery' || latestRun.method === 'realtime') && (
              <button className="btn btn-small" disabled={checking} onClick={() => checkAgain(latestRun.id)}>
                {checking ? 'Checking…' : 'Check again'}
              </button>
            )}
          </div>

          {latestRun.results.map((r) => (
            <div key={r.id} style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13 }}>{r.label}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)' }}>
                  {r.eventName}
                </span>
                <OutcomeBadge outcome={r.outcome} />
              </div>
              {r.detail && (
                <p style={{ fontSize: 11.5, color: 'var(--line-secondary)', margin: '6px 0 0' }}>{r.detail}</p>
              )}
              {r.outcome === 'pending_manual' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn btn-small" onClick={() => markManual(latestRun.id, r.id, 'pass')}>
                    Confirm seen in DebugView
                  </button>
                  <button className="btn btn-small" onClick={() => markManual(latestRun.id, r.id, 'fail')}>
                    Not seen
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
