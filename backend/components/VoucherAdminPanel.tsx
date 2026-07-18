'use client';

import { useEffect, useState } from 'react';

type Voucher = {
  id: string;
  code: string;
  type: 'percent_off' | 'amount_off' | 'trial_days';
  value: number;
  currency: string | null;
  duration: string | null;
  durationInMonths: number | null;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
  active: boolean;
  stripePromotionCodeId: string | null;
};

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  color: 'var(--line-primary)',
  border: '1px solid var(--line-ghost)',
  padding: 8,
  borderRadius: 2,
  fontSize: 12.5,
};

function valueLabel(type: Voucher['type']) {
  if (type === 'percent_off') return 'Percent off (1-100)';
  if (type === 'amount_off') return 'Amount off, in cents (500 = $5.00)';
  return 'Trial length, in days';
}

function formatValue(v: Voucher) {
  if (v.type === 'percent_off') return `${v.value}% off`;
  if (v.type === 'amount_off') return `${(v.value / 100).toFixed(2)} ${v.currency ?? ''} off`;
  return `${v.value}-day trial`;
}

export function VoucherAdminPanel() {
  const [vouchers, setVouchers] = useState<Voucher[] | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [origin, setOrigin] = useState('');

  const [code, setCode] = useState('');
  const [type, setType] = useState<Voucher['type']>('percent_off');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState('usd');
  const [duration, setDuration] = useState<'once' | 'repeating' | 'forever'>('once');
  const [durationInMonths, setDurationInMonths] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');

  function load() {
    fetch('/api/admin/vouchers')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setVouchers(data.vouchers);
      })
      .catch(() => setError('Could not load vouchers.'));
  }

  useEffect(() => {
    load();
    setOrigin(window.location.origin);
  }, []);

  async function createVoucher() {
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/admin/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          type,
          value: Number(value),
          currency: type === 'amount_off' ? currency : undefined,
          duration: type === 'trial_days' ? undefined : duration,
          durationInMonths: duration === 'repeating' ? Number(durationInMonths) : undefined,
          startsAt: startsAt || undefined,
          endsAt: endsAt || undefined,
          maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not create voucher.');
        return;
      }
      setCode('');
      setValue('');
      setDurationInMonths('');
      setStartsAt('');
      setEndsAt('');
      setMaxRedemptions('');
      load();
    } catch {
      setError('Could not create voucher — network error.');
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(v: Voucher) {
    const res = await fetch(`/api/admin/vouchers/${v.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !v.active }),
    });
    if (res.ok) load();
  }

  function copyLink(v: Voucher, plan: 'pro' | 'business') {
    const link = `${origin}/api/billing/redeem?voucher=${encodeURIComponent(v.code)}&plan=${plan}`;
    navigator.clipboard.writeText(link).catch(() => {});
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 16 }}>
        <div className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          New voucher
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          <input className="mono" style={inputStyle} placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <select className="mono" style={inputStyle} value={type} onChange={(e) => setType(e.target.value as Voucher['type'])}>
            <option value="percent_off">Percent off</option>
            <option value="amount_off">Amount off</option>
            <option value="trial_days">Trial days</option>
          </select>
          <input
            className="mono"
            style={inputStyle}
            type="number"
            placeholder={valueLabel(type)}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          {type === 'amount_off' && (
            <input className="mono" style={inputStyle} placeholder="currency (usd)" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          )}
          {type !== 'trial_days' && (
            <select className="mono" style={inputStyle} value={duration} onChange={(e) => setDuration(e.target.value as typeof duration)}>
              <option value="once">Once</option>
              <option value="repeating">Repeating</option>
              <option value="forever">Forever</option>
            </select>
          )}
          {type !== 'trial_days' && duration === 'repeating' && (
            <input
              className="mono"
              style={inputStyle}
              type="number"
              placeholder="months"
              value={durationInMonths}
              onChange={(e) => setDurationInMonths(e.target.value)}
            />
          )}
          <input className="mono" style={inputStyle} type="datetime-local" placeholder="starts" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          <input className="mono" style={inputStyle} type="datetime-local" placeholder="ends" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          <input
            className="mono"
            style={inputStyle}
            type="number"
            placeholder="max redemptions"
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
          />
        </div>
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-accent" disabled={creating || !code || !value} onClick={createVoucher}>
            {creating ? 'Creating…' : 'Create voucher'}
          </button>
        </div>
      </div>

      {error && <div style={{ color: 'var(--danger)', fontSize: 12.5 }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {vouchers?.map((v) => (
          <div key={v.id} style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span className="mono" style={{ fontSize: 14, color: v.active ? 'var(--accent)' : 'var(--line-secondary)' }}>
                {v.code}
              </span>
              <button className="btn" style={{ fontSize: 10, padding: '4px 10px' }} onClick={() => toggleActive(v)}>
                {v.active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
            <div className="mono" style={{ fontSize: 12, color: 'var(--line-secondary)', marginBottom: 6 }}>
              {formatValue(v)}
              {v.duration && v.type !== 'trial_days' ? ` · ${v.duration}${v.durationInMonths ? ` (${v.durationInMonths}mo)` : ''}` : ''}
            </div>
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--line-secondary)', marginBottom: 8 }}>
              {v.startsAt ? `from ${new Date(v.startsAt).toLocaleString()} ` : ''}
              {v.endsAt ? `until ${new Date(v.endsAt).toLocaleString()} ` : 'no expiry '}
              · redeemed {v.timesRedeemed}
              {v.maxRedemptions ? ` / ${v.maxRedemptions}` : ''}
              {v.stripePromotionCodeId ? ' · typeable at Checkout' : ' · link-only'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ fontSize: 10, padding: '4px 10px' }} onClick={() => copyLink(v, 'pro')}>
                Copy Pro link
              </button>
              <button className="btn" style={{ fontSize: 10, padding: '4px 10px' }} onClick={() => copyLink(v, 'business')}>
                Copy Business link
              </button>
            </div>
          </div>
        ))}
        {vouchers?.length === 0 && (
          <div className="mono" style={{ fontSize: 12, color: 'var(--line-secondary)' }}>
            No vouchers yet.
          </div>
        )}
      </div>
    </div>
  );
}
