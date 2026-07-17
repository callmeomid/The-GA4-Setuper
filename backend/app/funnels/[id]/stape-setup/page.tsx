'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type StapeDomainPlan = { rootDomain: string; proposedName: string; outcome: 'new' | 'reuse'; description: string };
type StapeContainerPlan = { outcome: 'new' | 'reuse'; name: string; code: string; description: string };
type Plan = {
  spansSubdomains: boolean;
  hostnames: string[];
  container: StapeContainerPlan;
  domains: StapeDomainPlan[];
  cookieDomainValue: string;
  crossDomainWarning: string | null;
};
type DnsRecord = { type: { type: string; name?: string }; host: string; value: string };
type DomainResult = { rootDomain: string; domainName: string; outcome: 'created' | 'reused' | 'error'; records?: DnsRecord[]; error?: string };
type PushResult = {
  container: { identifier: string; name: string; outcome: string };
  domains: DomainResult[];
  cookieDomainValue: string;
  crossDomainWarning: string | null;
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

export default function StapeSetupPage({ params }: { params: { id: string } }) {
  const [needsAnswer, setNeedsAnswer] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loadError, setLoadError] = useState('');
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<PushResult | null>(null);
  const [pushError, setPushError] = useState('');

  function loadPlan() {
    setLoadError('');
    fetch(`/api/funnels/${params.id}/stape-plan`)
      .then((r) => r.json())
      .then((data) => {
        if (data.needsSubdomainAnswer) setNeedsAnswer(true);
        else if (data.error) setLoadError(data.error);
        else setPlan(data.plan);
      })
      .catch(() => setLoadError('Could not load the Stape setup plan.'));
  }

  useEffect(loadPlan, [params.id]);

  async function answerSubdomains(value: boolean) {
    setAnswering(true);
    try {
      const res = await fetch(`/api/funnels/${params.id}/spans-subdomains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spansSubdomains: value }),
      });
      if (res.ok) {
        setNeedsAnswer(false);
        loadPlan();
      }
    } finally {
      setAnswering(false);
    }
  }

  async function push() {
    setPushing(true);
    setPushError('');
    try {
      const res = await fetch(`/api/funnels/${params.id}/stape-push`, { method: 'POST' });
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
        <Link href={`/funnels/${params.id}/stape-log`} className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
          View API call log →
        </Link>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginTop: 16, marginBottom: 4 }}>Set up in Stape.io</h1>
      <p style={{ fontSize: 13, color: 'var(--line-secondary)', marginTop: 0, marginBottom: 20 }}>
        Creates a server-side GTM container and a first-party collection domain. DNS records still need to be added
        by you — nothing here touches your DNS provider automatically.
      </p>

      {needsAnswer && (
        <div style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 20 }}>
          <p style={{ fontSize: 14, margin: '0 0 14px' }}>Does this funnel span multiple subdomains of the same site?</p>
          <p style={{ fontSize: 12, color: 'var(--line-secondary)', margin: '0 0 16px' }}>
            e.g. checkout happens on checkout.example.com but browsing happens on www.example.com. This changes how
            the collection domain and cookie are set up — a "yes" gets one shared root-domain cookie so a visitor
            stays the same person across subdomains; a "no" keeps things scoped to a single host.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-accent" disabled={answering} onClick={() => answerSubdomains(true)}>
              Yes, spans subdomains
            </button>
            <button className="btn" disabled={answering} onClick={() => answerSubdomains(false)}>
              No, single host
            </button>
          </div>
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
          {plan.crossDomainWarning && (
            <div style={{ border: '1px solid var(--amber)', borderRadius: 2, padding: 12, marginBottom: 16, fontSize: 12.5, color: 'var(--amber)' }}>
              ⚠ {plan.crossDomainWarning}
            </div>
          )}

          <div style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 14, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 13 }}>Server container</span>
              <OutcomeBadge outcome={plan.container.outcome} />
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--line-secondary)', margin: 0 }}>{plan.container.description}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {plan.domains.map((d) => (
              <div key={d.proposedName} style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span className="mono" style={{ fontSize: 13, color: 'var(--accent)' }}>
                    {d.proposedName}
                  </span>
                  <OutcomeBadge outcome={d.outcome} />
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--line-secondary)', margin: 0 }}>{d.description}</p>
              </div>
            ))}
          </div>

          <div className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', marginBottom: 16 }}>
            Cookie domain to set on the GA4 tag in GTM: <span style={{ color: 'var(--accent)' }}>{plan.cookieDomainValue}</span>
          </div>

          {pushError && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 12 }}>{pushError}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-accent" disabled={pushing} onClick={push}>
              {pushing ? 'Pushing…' : 'Push to Stape'}
            </button>
          </div>
        </>
      )}

      {pushResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13 }}>{pushResult.container.name}</span>
              <OutcomeBadge outcome={pushResult.container.outcome} />
            </div>
          </div>

          {pushResult.domains.map((d) => (
            <div key={d.domainName} style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: d.records?.length ? 10 : 0 }}>
                <span className="mono" style={{ fontSize: 13 }}>
                  {d.domainName}
                </span>
                <OutcomeBadge outcome={d.outcome} />
              </div>
              {d.error && <div style={{ fontSize: 11, color: 'var(--danger)' }}>{d.error}</div>}
              {d.records && d.records.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--line-secondary)' }}>
                    ADD THESE DNS RECORDS AT YOUR PROVIDER
                  </div>
                  {d.records.map((r, i) => (
                    <div key={i} className="mono" style={{ fontSize: 10.5, color: 'var(--line-secondary)' }}>
                      {r.type.name ?? r.type.type} · {r.host} → {r.value}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div style={{ border: '1px solid var(--accent)', borderRadius: 2, padding: 14, marginTop: 8 }}>
            <p style={{ fontSize: 13, color: 'var(--accent)', margin: 0 }}>✓ Stape container and domain(s) configured.</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Link href={`/funnels/${params.id}/validate`} className="btn btn-accent" style={{ textDecoration: 'none' }}>
              Next: run validation →
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
