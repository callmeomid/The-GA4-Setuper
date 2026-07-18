'use client';

import { useState } from 'react';

type Props = {
  planId: 'free' | 'pro' | 'business';
  planLabel: string;
  planStatus: string | null;
  pushedCount: number;
  funnelPushLimit: number | null;
  hasStripeCustomer: boolean;
  voucherError: string | null;
  upgraded: boolean;
};

async function goToCheckout(plan: 'pro' | 'business', setBusy: (b: boolean) => void, setError: (e: string) => void) {
  setBusy(true);
  setError('');
  try {
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Could not start checkout.');
      setBusy(false);
      return;
    }
    window.location.href = data.url;
  } catch {
    setError('Could not start checkout — network error.');
    setBusy(false);
  }
}

async function goToPortal(setBusy: (b: boolean) => void, setError: (e: string) => void) {
  setBusy(true);
  setError('');
  try {
    const res = await fetch('/api/billing/portal', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Could not open billing portal.');
      setBusy(false);
      return;
    }
    window.location.href = data.url;
  } catch {
    setError('Could not open billing portal — network error.');
    setBusy(false);
  }
}

export function BillingPanel({ planId, planLabel, planStatus, pushedCount, funnelPushLimit, hasStripeCustomer, voucherError, upgraded }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const limitLabel = funnelPushLimit === null ? 'unlimited' : `${pushedCount} of ${funnelPushLimit}`;
  const atLimit = funnelPushLimit !== null && pushedCount >= funnelPushLimit;

  return (
    <div id="billing" style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 16, marginBottom: 24 }}>
      <div className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Billing
      </div>

      {upgraded && (
        <div style={{ border: '1px solid var(--accent)', borderRadius: 2, padding: 10, marginBottom: 12, fontSize: 12.5, color: 'var(--accent)' }}>
          ✓ Plan updated.
        </div>
      )}
      {voucherError && (
        <div style={{ border: '1px solid var(--danger)', borderRadius: 2, padding: 10, marginBottom: 12, fontSize: 12.5, color: 'var(--danger)' }}>
          {voucherError}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13 }}>
          Plan: <span className="mono" style={{ color: 'var(--accent)' }}>{planLabel}</span>
        </span>
        {planStatus && planStatus !== 'active' && (
          <span className="mono" style={{ fontSize: 10, color: 'var(--danger)', textTransform: 'uppercase' }}>
            {planStatus}
          </span>
        )}
      </div>

      <div className="mono" style={{ fontSize: 12, color: atLimit ? 'var(--danger)' : 'var(--line-secondary)', marginBottom: 14 }}>
        Funnels pushed to GTM: {limitLabel}
      </div>

      {error && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 10 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {planId !== 'pro' && (
          <button className="btn btn-accent" disabled={busy} onClick={() => goToCheckout('pro', setBusy, setError)}>
            Upgrade to Pro — $29/mo
          </button>
        )}
        {planId !== 'business' && (
          <button className="btn" disabled={busy} onClick={() => goToCheckout('business', setBusy, setError)}>
            Upgrade to Business — $99/mo
          </button>
        )}
        {hasStripeCustomer && (
          <button className="btn" disabled={busy} onClick={() => goToPortal(setBusy, setError)}>
            Manage billing
          </button>
        )}
      </div>
    </div>
  );
}
