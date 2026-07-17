'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type StepPlan = { stepId: string; order: number; label: string; eventName: string; outcome: 'new' | 'reuse'; description: string; warnings: string[] };
type PushResult = {
  results: { stepId: string; label: string; eventName: string; outcome: string; error?: string }[];
  propertyUrl: string;
};

function OutcomeBadge({ outcome }: { outcome: string }) {
  const color = outcome === 'error' ? 'var(--danger)' : outcome === 'new' || outcome === 'created' ? 'var(--accent)' : 'var(--line-secondary)';
  return (
    <span
      className="mono"
      style={{ fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase', color, border: `1px solid ${color}`, borderRadius: 2, padding: '2px 6px' }}
    >
      {outcome}
    </span>
  );
}

export default function Ga4SetupPage({ params }: { params: { id: string } }) {
  const [plan, setPlan] = useState<StepPlan[] | null>(null);
  const [propertyDisplayName, setPropertyDisplayName] = useState('');
  const [loadError, setLoadError] = useState('');
  const [eventNameOverrides, setEventNameOverrides] = useState<Record<string, string>>({});
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<PushResult | null>(null);
  const [pushError, setPushError] = useState('');

  useEffect(() => {
    fetch(`/api/funnels/${params.id}/ga4-plan`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setLoadError(data.error);
        else {
          setPlan(data.plan);
          setPropertyDisplayName(data.propertyDisplayName ?? '');
        }
      })
      .catch(() => setLoadError('Could not load the GA4 setup plan.'));
  }, [params.id]);

  async function push() {
    setPushing(true);
    setPushError('');
    try {
      const res = await fetch(`/api/funnels/${params.id}/ga4-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventNameOverrides }),
      });
      const data = await res.json();
      if (!res.ok) setPushError(data.error ?? 'Push failed.');
      else setPushResult(data);
    } catch {
      setPushError('Push failed — network error.');
    } finally {
      setPushing(false);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Link href={`/funnels/${params.id}`} className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
          &larr; Back to funnel
        </Link>
        <Link
          href={`/funnels/${params.id}/integration-log?system=ga4`}
          className="mono"
          style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}
        >
          View API call log →
        </Link>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginTop: 16, marginBottom: 4 }}>Set up in Google Analytics</h1>
      <p style={{ fontSize: 13, color: 'var(--line-secondary)', marginTop: 0, marginBottom: 20 }}>
        Creates (or confirms) a custom conversion event per step directly on your GA4 property. Unlike GTM, GA4 has
        no draft/publish split — a conversion event is live the moment it's created. Review the plan below before
        pushing.
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

      {plan && !pushResult && (
        <>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--line-secondary)', marginBottom: 16 }}>
            Property: {propertyDisplayName}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {plan.map((step) => {
              const eventName = eventNameOverrides[step.stepId] ?? step.eventName;
              return (
                <div key={step.stepId} style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 14 }}>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--line-secondary)', marginBottom: 4 }}>
                    STEP {String(step.order).padStart(2, '0')}
                  </div>
                  <div style={{ fontSize: 13.5, marginBottom: 10 }}>{step.label}</div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                    <p style={{ fontSize: 12.5, color: 'var(--line-secondary)', margin: 0, flex: 1 }}>{step.description}</p>
                    <OutcomeBadge outcome={step.outcome} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: step.warnings.length ? 8 : 0 }}>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--line-secondary)' }}>
                      event name:
                    </span>
                    <input
                      value={eventName}
                      onChange={(e) => setEventNameOverrides((prev) => ({ ...prev, [step.stepId]: e.target.value }))}
                      className="mono"
                      style={{ background: 'var(--bg)', color: 'var(--accent)', border: '1px solid var(--line-ghost)', padding: '4px 8px', borderRadius: 2, fontSize: 12 }}
                    />
                  </div>

                  {step.warnings.map((w) => (
                    <div key={w} style={{ fontSize: 11, color: '#ffb84d', marginBottom: 4 }}>
                      ⚠ {w}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {pushError && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 12 }}>{pushError}</div>}

          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-accent" disabled={pushing || plan.length === 0} onClick={push}>
              {pushing ? 'Pushing…' : 'Create conversion events in GA4'}
            </button>
          </div>
        </>
      )}

      {pushResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pushResult.results.map((r) => (
            <div key={r.stepId} style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13 }}>{r.label}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)' }}>
                {r.eventName}
              </span>
              <OutcomeBadge outcome={r.outcome} />
              {r.error && <span style={{ fontSize: 11, color: 'var(--danger)' }}>{r.error}</span>}
            </div>
          ))}
          <div style={{ border: '1px solid var(--accent)', borderRadius: 2, padding: 14, marginTop: 8 }}>
            <p style={{ fontSize: 13, color: 'var(--accent)', margin: '0 0 8px' }}>✓ Conversion events written to your GA4 property.</p>
            <a href={pushResult.propertyUrl} target="_blank" rel="noreferrer" className="btn btn-accent" style={{ textDecoration: 'none', display: 'inline-block' }}>
              Open Google Analytics to review →
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
