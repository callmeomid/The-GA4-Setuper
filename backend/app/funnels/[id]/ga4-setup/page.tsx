'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Ga4StepPlan = {
  stepId: string;
  order: number;
  label: string;
  eventName: string;
  outcome: 'new' | 'reuse' | 'conflict';
  description: string;
  conflictReason?: string;
};
type Plan = {
  propertyId: string;
  propertyDisplayName: string;
  steps: Ga4StepPlan[];
  otherExistingConversionEvents: { eventName: string; custom: boolean }[];
  existingConversionEventCount: number;
  nearCapWarning: string | null;
};
type PushResult = {
  results: { stepId: string; label: string; eventName: string; outcome: string; error?: string }[];
  propertyUrl: string;
};

function OutcomeBadge({ outcome }: { outcome: string }) {
  const color = outcome === 'conflict' || outcome === 'error' ? 'var(--danger)' : outcome === 'new' || outcome === 'created' ? 'var(--accent)' : 'var(--line-secondary)';
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
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loadError, setLoadError] = useState('');
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<PushResult | null>(null);
  const [pushError, setPushError] = useState('');

  useEffect(() => {
    fetch(`/api/funnels/${params.id}/ga4-plan`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setLoadError(data.error);
        else setPlan(data.plan);
      })
      .catch(() => setLoadError('Could not load the GA4 setup plan.'));
  }, [params.id]);

  async function push() {
    setPushing(true);
    setPushError('');
    try {
      const res = await fetch(`/api/funnels/${params.id}/ga4-push`, { method: 'POST' });
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
        <Link href={`/funnels/${params.id}/ga4-log`} className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
          View API call log →
        </Link>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginTop: 16, marginBottom: 4 }}>Set up in Google Analytics 4</h1>
      <p style={{ fontSize: 13, color: 'var(--amber)', marginTop: 0, marginBottom: 20 }}>
        GA4 has no draft mode. Marking an event as a conversion below takes effect on the live property the moment
        you push — there's nothing to separately publish.
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
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--line-secondary)', marginBottom: 8 }}>
            Property: {plan.propertyDisplayName} ({plan.propertyId}) · {plan.existingConversionEventCount} existing conversion events
          </div>

          {plan.nearCapWarning && (
            <div style={{ border: '1px solid var(--amber)', borderRadius: 2, padding: 12, marginBottom: 16, fontSize: 12.5, color: 'var(--amber)' }}>
              {plan.nearCapWarning}
            </div>
          )}

          {plan.otherExistingConversionEvents.length > 0 && (
            <details style={{ marginBottom: 16 }}>
              <summary className="mono" style={{ fontSize: 10.5, color: 'var(--line-secondary)', cursor: 'pointer' }}>
                {plan.otherExistingConversionEvents.length} other conversion events already exist on this property —
                view before adding more
              </summary>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {plan.otherExistingConversionEvents.map((e) => (
                  <span
                    key={e.eventName}
                    className="mono"
                    style={{ fontSize: 10, border: '1px solid var(--line-ghost)', borderRadius: 2, padding: '3px 7px', color: 'var(--line-secondary)' }}
                  >
                    {e.eventName}
                    {!e.custom && <span style={{ opacity: 0.6 }}> (default)</span>}
                  </span>
                ))}
              </div>
            </details>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {plan.steps.map((step) => (
              <div key={step.stepId} style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 14 }}>
                <div className="mono" style={{ fontSize: 10, color: 'var(--line-secondary)', marginBottom: 4 }}>
                  STEP {String(step.order).padStart(2, '0')}
                </div>
                <div style={{ fontSize: 13.5, marginBottom: 10 }}>{step.label}</div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <p style={{ fontSize: 12.5, color: 'var(--line-secondary)', margin: 0, flex: 1 }}>
                    <strong className="mono" style={{ color: 'var(--accent)' }}>
                      {step.eventName}
                    </strong>{' '}
                    — {step.description}
                    {step.conflictReason && <span style={{ display: 'block', color: 'var(--danger)', marginTop: 4 }}>{step.conflictReason}</span>}
                  </p>
                  <OutcomeBadge outcome={step.outcome} />
                </div>
              </div>
            ))}
          </div>

          {pushError && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 12 }}>{pushError}</div>}

          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-accent" disabled={pushing} onClick={push}>
              {pushing ? 'Pushing…' : 'Push to GA4 (live immediately)'}
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
            <p style={{ fontSize: 13, color: 'var(--accent)', margin: '0 0 8px' }}>✓ Live on your GA4 property.</p>
            <a href={pushResult.propertyUrl} target="_blank" rel="noreferrer" className="btn btn-accent" style={{ textDecoration: 'none', display: 'inline-block' }}>
              Open GA4 Admin → Conversion events →
            </a>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Link href={`/funnels/${params.id}/stape-setup`} className="btn btn-accent" style={{ textDecoration: 'none' }}>
              Next: set up Stape.io →
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
