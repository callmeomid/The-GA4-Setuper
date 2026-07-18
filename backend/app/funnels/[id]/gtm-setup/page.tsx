'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type PlanItem = { outcome: 'new' | 'reuse' | 'conflict'; name: string; description: string; conflictReason?: string };
type StepPlan = {
  stepId: string;
  order: number;
  label: string;
  eventName: string;
  trigger: PlanItem;
  tag: PlanItem;
  warnings: string[];
};
type Plan = {
  workspaceName: string;
  setupMode: 'client' | 'server';
  ga4Config: { outcome: 'new' | 'reuse' | 'upgrade'; tagName: string; measurementId: string | null; description: string };
  steps: StepPlan[];
  blockedReason: string | null;
};
type StapeInfo = { subdomain: string | null; containerUrl: string | null; status: string } | null;
type TechnicalStep = { stepId: string; triggerResource: unknown; tagResource: unknown };
type PushResult = {
  results: { stepId: string; label: string; trigger: string; tag: string; error?: string }[];
  ga4ConfigTagName: string;
  workspaceUrl: string;
  stapeContainerUrl: string | null;
};

function OutcomeBadge({ outcome }: { outcome: string }) {
  const color =
    outcome === 'conflict' || outcome === 'error'
      ? 'var(--danger)'
      : outcome === 'new'
        ? 'var(--accent)'
        : outcome === 'upgrade'
          ? 'var(--amber)'
          : 'var(--line-secondary)';
  return (
    <span
      className="mono"
      style={{ fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase', color, border: `1px solid ${color}`, borderRadius: 2, padding: '2px 6px' }}
    >
      {outcome}
    </span>
  );
}

export default function GtmSetupPage({ params }: { params: { id: string } }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [stape, setStape] = useState<StapeInfo>(null);
  const [technical, setTechnical] = useState<TechnicalStep[]>([]);
  const [loadError, setLoadError] = useState('');
  const [measurementId, setMeasurementId] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [eventNameOverrides, setEventNameOverrides] = useState<Record<string, string>>({});
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<PushResult | null>(null);
  const [pushError, setPushError] = useState('');
  const [upgradeUrl, setUpgradeUrl] = useState('');

  useEffect(() => {
    fetch(`/api/funnels/${params.id}/gtm-plan`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setLoadError(data.error);
        else {
          setPlan(data.plan);
          setTechnical(data.technicalSteps ?? []);
          setStape(data.stape ?? null);
          if (data.stape?.subdomain) setSubdomain(data.stape.subdomain);
        }
      })
      .catch(() => setLoadError('Could not load the GTM setup plan.'));
  }, [params.id]);

  const isServerMode = plan?.setupMode === 'server';
  const needsSubdomain = isServerMode && !subdomain;

  async function push() {
    setPushing(true);
    setPushError('');
    setUpgradeUrl('');
    try {
      const res = await fetch(`/api/funnels/${params.id}/gtm-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ga4MeasurementId: measurementId || undefined,
          eventNameOverrides,
          stapeSubdomain: isServerMode ? subdomain : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPushError(data.error ?? 'Push failed.');
        if (res.status === 402) setUpgradeUrl(data.upgradeUrl ?? '/settings#billing');
      } else {
        setPushResult(data);
      }
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
        <Link href={`/funnels/${params.id}/gtm-log`} className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
          View API call log →
        </Link>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginTop: 16, marginBottom: 4 }}>Set up in Google Tag Manager</h1>
      <p style={{ fontSize: 13, color: 'var(--line-secondary)', marginTop: 0, marginBottom: 8 }}>
        Everything below is written to a draft workspace only. Nothing is published automatically — you review and
        publish from GTM yourself.
      </p>
      {plan && (
        <div
          className="mono"
          style={{
            display: 'inline-block',
            fontSize: 10,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: isServerMode ? 'var(--amber)' : 'var(--accent)',
            border: `1px solid ${isServerMode ? 'var(--amber)' : 'var(--accent)'}`,
            borderRadius: 2,
            padding: '3px 8px',
            marginBottom: 20,
          }}
        >
          {isServerMode ? 'Server-side · GTM + GA4 + Stape.io' : 'Client-side · GTM + GA4'}
        </div>
      )}

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
            Workspace: {plan.workspaceName}
          </div>

          {isServerMode && (
            <div style={{ border: '1px solid var(--amber)', borderRadius: 2, padding: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13 }}>Stape.io server container</span>
                <span
                  className="mono"
                  style={{ fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--amber)', border: '1px solid var(--amber)', borderRadius: 2, padding: '2px 6px' }}
                >
                  {stape?.status === 'created' ? 'ready' : 'setup required'}
                </span>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--line-secondary)', margin: '0 0 8px' }}>
                {stape?.containerUrl
                  ? `Container is live at ${stape.containerUrl}. Re-pushing reuses it — it won't create a second one.`
                  : "Not created yet. Point this subdomain's CNAME at Stape before pushing so the container can go live."}
              </p>
              <input
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
                placeholder="gtm.yoursite.com"
                className="mono"
                style={{ background: 'var(--bg)', color: 'var(--line-primary)', border: '1px solid var(--line-ghost)', padding: 8, borderRadius: 2, width: '100%' }}
              />
            </div>
          )}

          <div style={{ border: `1px solid ${plan.ga4Config.outcome === 'upgrade' ? 'var(--amber)' : 'var(--line-ghost)'}`, borderRadius: 2, padding: 14, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 13 }}>GA4 Configuration</span>
              <OutcomeBadge outcome={plan.ga4Config.outcome} />
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--line-secondary)', margin: plan.ga4Config.outcome === 'new' ? '0 0 8px' : 0 }}>
              {plan.ga4Config.description}
              {plan.ga4Config.outcome !== 'new' && plan.ga4Config.measurementId && (
                <>
                  {' '}
                  (measurement ID <span className="mono">{plan.ga4Config.measurementId}</span>)
                </>
              )}
            </p>
            {plan.ga4Config.outcome === 'new' && (
              <input
                value={measurementId}
                onChange={(e) => setMeasurementId(e.target.value)}
                placeholder="G-XXXXXXX"
                className="mono"
                style={{ background: 'var(--bg)', color: 'var(--line-primary)', border: '1px solid var(--line-ghost)', padding: 8, borderRadius: 2, width: '100%' }}
              />
            )}
          </div>

          {plan.blockedReason && !measurementId && (
            <div style={{ border: '1px solid var(--amber, #ffb84d)', borderRadius: 2, padding: 12, marginBottom: 16, fontSize: 12.5, color: 'var(--amber, #ffb84d)' }}>
              {plan.blockedReason}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {plan.steps.map((step, i) => {
              const eventName = eventNameOverrides[step.stepId] ?? step.eventName;
              const tech = technical.find((t) => t.stepId === step.stepId);
              return (
                <div key={step.stepId} style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 14 }}>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--line-secondary)', marginBottom: 4 }}>
                    STEP {String(step.order).padStart(2, '0')}
                  </div>
                  <div style={{ fontSize: 13.5, marginBottom: 10 }}>{step.label}</div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                    <p style={{ fontSize: 12.5, color: 'var(--line-secondary)', margin: 0, flex: 1 }}>
                      <strong style={{ color: 'var(--line-primary)' }}>Trigger — </strong>
                      {step.trigger.description}
                      {step.trigger.conflictReason && (
                        <span style={{ display: 'block', color: 'var(--danger)', marginTop: 4 }}>{step.trigger.conflictReason}</span>
                      )}
                    </p>
                    <OutcomeBadge outcome={step.trigger.outcome} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                    <p style={{ fontSize: 12.5, color: 'var(--line-secondary)', margin: 0, flex: 1 }}>
                      <strong style={{ color: 'var(--line-primary)' }}>Tag — </strong>
                      {step.tag.description}
                      {step.tag.conflictReason && (
                        <span style={{ display: 'block', color: 'var(--danger)', marginTop: 4 }}>{step.tag.conflictReason}</span>
                      )}
                    </p>
                    <OutcomeBadge outcome={step.tag.outcome} />
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

                  <details>
                    <summary className="mono" style={{ fontSize: 10, color: 'var(--line-secondary)', cursor: 'pointer' }}>
                      Technical details
                    </summary>
                    <pre className="mono" style={{ fontSize: 10, color: 'var(--line-secondary)', overflow: 'auto', marginTop: 6 }}>
                      {JSON.stringify(tech, null, 2)}
                    </pre>
                  </details>
                </div>
              );
            })}
          </div>

          {pushError && !upgradeUrl && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 12 }}>{pushError}</div>}

          {upgradeUrl && (
            <div style={{ border: '1px solid var(--amber, #ffb84d)', borderRadius: 2, padding: 14, marginTop: 12 }}>
              <p style={{ fontSize: 12.5, color: 'var(--amber, #ffb84d)', margin: '0 0 10px' }}>{pushError}</p>
              <Link href={upgradeUrl} className="btn btn-accent" style={{ textDecoration: 'none', display: 'inline-block' }}>
                Upgrade plan →
              </Link>
            </div>
          )}

          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-accent"
              disabled={pushing || (Boolean(plan.blockedReason) && !measurementId) || needsSubdomain}
              onClick={push}
            >
              {pushing ? 'Pushing…' : 'Push to GTM (draft only)'}
            </button>
          </div>
        </>
      )}

      {pushResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pushResult.results.map((r) => (
            <div key={r.stepId} style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13 }}>{r.label}</span>
              <span style={{ display: 'flex', gap: 6 }}>
                <OutcomeBadge outcome={r.trigger} />
                <OutcomeBadge outcome={r.tag} />
              </span>
              {r.error && <span style={{ fontSize: 11, color: 'var(--danger)' }}>{r.error}</span>}
            </div>
          ))}
          <div style={{ border: '1px solid var(--accent)', borderRadius: 2, padding: 14, marginTop: 8 }}>
            <p style={{ fontSize: 13, color: 'var(--accent)', margin: '0 0 8px' }}>
              ✓ Draft written to your workspace. Nothing has been published.
            </p>
            {pushResult.stapeContainerUrl && (
              <p style={{ fontSize: 12, color: 'var(--line-secondary)', margin: '0 0 8px' }}>
                Server container: <span className="mono">{pushResult.stapeContainerUrl}</span>
              </p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <a href={pushResult.workspaceUrl} target="_blank" rel="noreferrer" className="btn btn-accent" style={{ textDecoration: 'none', display: 'inline-block' }}>
                Open Google Tag Manager to review &amp; publish →
              </a>
              <Link href={`/funnels/${params.id}/validate`} className="btn" style={{ textDecoration: 'none', display: 'inline-block' }}>
                Validate in GA4 →
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
