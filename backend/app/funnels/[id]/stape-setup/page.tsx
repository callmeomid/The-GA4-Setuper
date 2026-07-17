'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Topology = 'single' | 'cross_subdomain' | 'cross_domain';
type DomainConfig = { cookieDomain: string | null; allowedDomains: string[]; warnings: string[] };
type StapePlan = { container: { outcome: 'new' | 'reuse'; name: string; description: string }; domain: DomainConfig; warnings: string[] };
type PushResult = { container: { id: string; name: string; domain: string }; domain: DomainConfig; warnings: string[] };

const TOPOLOGY_OPTIONS: { value: Topology; label: string; description: string }[] = [
  { value: 'single', label: 'Single domain', description: 'Every step happens on one hostname.' },
  { value: 'cross_subdomain', label: 'Cross-subdomain', description: 'Steps span subdomains of the same root domain (e.g. www → checkout).' },
  { value: 'cross_domain', label: 'Cross-domain', description: 'Steps span entirely different root domains.' },
];

export default function StapeSetupPage({ params }: { params: { id: string } }) {
  const [detectedDomains, setDetectedDomains] = useState<string[]>([]);
  const [primaryDomain, setPrimaryDomain] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const [topology, setTopology] = useState<Topology | ''>('');
  const [rootDomain, setRootDomain] = useState('');
  const [allowedDomains, setAllowedDomains] = useState('');

  const [plan, setPlan] = useState<StapePlan | null>(null);
  const [planError, setPlanError] = useState('');

  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<PushResult | null>(null);
  const [pushError, setPushError] = useState('');

  useEffect(() => {
    fetch(`/api/funnels/${params.id}/stape-plan`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setLoadError(data.error);
        else {
          setDetectedDomains(data.detectedDomains ?? []);
          setPrimaryDomain(data.primaryDomain ?? '');
          setAllowedDomains((data.detectedDomains ?? []).join(', '));
          if (data.detectedDomains?.length > 1) setTopology('cross_domain');
        }
      })
      .catch(() => setLoadError('Could not load funnel domains.'))
      .finally(() => setLoaded(true));
  }, [params.id]);

  async function fetchPlan() {
    if (!topology) return;
    setPlanError('');
    const q = new URLSearchParams({ topology, ...(rootDomain ? { rootDomain } : {}), allowedDomains });
    const res = await fetch(`/api/funnels/${params.id}/stape-plan?${q}`);
    const data = await res.json();
    if (!res.ok || data.error) {
      setPlanError(data.error ?? 'Could not load plan.');
      setPlan(null);
    } else {
      setPlan(data.plan);
    }
  }

  async function push() {
    setPushing(true);
    setPushError('');
    try {
      const res = await fetch(`/api/funnels/${params.id}/stape-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topology,
          rootDomain: rootDomain || null,
          allowedDomains: allowedDomains.split(',').map((d) => d.trim()).filter(Boolean),
        }),
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
          href={`/funnels/${params.id}/integration-log?system=stape`}
          className="mono"
          style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}
        >
          View API call log →
        </Link>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginTop: 16, marginBottom: 4 }}>Set up in Stape</h1>
      <p style={{ fontSize: 13, color: 'var(--line-secondary)', marginTop: 0, marginBottom: 20 }}>
        Creates (or reuses) a server-side container and its first-party domain/cookie config. This is a live write —
        review the plan below before pushing.
      </p>

      {loadError && <div style={{ border: '1px solid var(--danger)', borderRadius: 2, padding: 14, fontSize: 13, color: 'var(--danger)' }}>{loadError}</div>}

      {loaded && !loadError && !pushResult && (
        <>
          <div style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 13, marginBottom: 4 }}>Does this funnel span multiple subdomains or domains?</div>
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--line-secondary)', marginBottom: 10 }}>
              Detected in this funnel's steps: {detectedDomains.join(', ') || '—'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TOPOLOGY_OPTIONS.map((opt) => (
                <label key={opt.value} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input type="radio" name="topology" checked={topology === opt.value} onChange={() => setTopology(opt.value)} style={{ marginTop: 3 }} />
                  <span>
                    <span style={{ fontSize: 13 }}>{opt.label}</span>
                    <br />
                    <span style={{ fontSize: 11.5, color: 'var(--line-secondary)' }}>{opt.description}</span>
                  </span>
                </label>
              ))}
            </div>

            {topology === 'cross_subdomain' && (
              <div style={{ marginTop: 10 }}>
                <input
                  value={rootDomain}
                  onChange={(e) => setRootDomain(e.target.value)}
                  placeholder="example.com"
                  className="mono"
                  style={{ background: 'var(--bg)', color: 'var(--line-primary)', border: '1px solid var(--line-ghost)', padding: 8, borderRadius: 2, width: '100%' }}
                />
              </div>
            )}

            {topology === 'cross_domain' && (
              <div style={{ marginTop: 10 }}>
                <input
                  value={allowedDomains}
                  onChange={(e) => setAllowedDomains(e.target.value)}
                  placeholder="example.com, partner-checkout.com"
                  className="mono"
                  style={{ background: 'var(--bg)', color: 'var(--line-primary)', border: '1px solid var(--line-ghost)', padding: 8, borderRadius: 2, width: '100%' }}
                />
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <button className="btn" disabled={!topology || (topology === 'cross_subdomain' && !rootDomain)} onClick={fetchPlan}>
                Preview setup
              </button>
            </div>
          </div>

          {planError && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 16 }}>{planError}</div>}

          {plan && (
            <>
              <div style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13 }}>Server container</span>
                  <span
                    className="mono"
                    style={{ fontSize: 9, textTransform: 'uppercase', color: plan.container.outcome === 'new' ? 'var(--accent)' : 'var(--line-secondary)', border: `1px solid ${plan.container.outcome === 'new' ? 'var(--accent)' : 'var(--line-secondary)'}`, borderRadius: 2, padding: '2px 6px' }}
                  >
                    {plan.container.outcome}
                  </span>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--line-secondary)', margin: 0 }}>{plan.container.description}</p>
              </div>

              <div style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 13, marginBottom: 8 }}>Domain / cookie config</div>
                <div className="mono" style={{ fontSize: 11.5, color: 'var(--line-secondary)', marginBottom: 4 }}>
                  cookie domain: {plan.domain.cookieDomain ?? '(host-only — not shared across domains)'}
                </div>
                <div className="mono" style={{ fontSize: 11.5, color: 'var(--line-secondary)' }}>
                  allowed domains: {plan.domain.allowedDomains.join(', ')}
                </div>
                {plan.domain.warnings.map((w) => (
                  <div key={w} style={{ fontSize: 11, color: '#ffb84d', marginTop: 8 }}>
                    ⚠ {w}
                  </div>
                ))}
              </div>

              {pushError && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 12 }}>{pushError}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-accent" disabled={pushing} onClick={push}>
                  {pushing ? 'Pushing…' : 'Set up in Stape'}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {pushResult && (
        <div style={{ border: '1px solid var(--accent)', borderRadius: 2, padding: 14 }}>
          <p style={{ fontSize: 13, color: 'var(--accent)', margin: '0 0 8px' }}>
            ✓ Container "{pushResult.container.name}" ready at <span className="mono">{pushResult.container.domain}</span>.
          </p>
          {pushResult.warnings.map((w) => (
            <div key={w} style={{ fontSize: 11, color: '#ffb84d', marginTop: 6 }}>
              ⚠ {w}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
