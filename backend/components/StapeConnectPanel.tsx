'use client';

import { useState } from 'react';

export function StapeConnectPanel({ connected }: { connected: boolean }) {
  const [apiKey, setApiKey] = useState('');
  const [region, setRegion] = useState<'global' | 'eu'>('global');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/stape/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, region }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? 'Could not verify this API key.');
      else setSaved(true);
    } catch {
      setError('Could not reach the backend.');
    } finally {
      setSaving(false);
    }
  }

  if (connected && !saved) {
    return (
      <div className="mono" style={{ fontSize: 12, color: 'var(--line-secondary)' }}>
        Connected — <span style={{ color: 'var(--accent)' }}>Stape API key on file</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 }}>
      <div className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)' }}>
        Stape has no OAuth — paste an account-level API key from Stape (Account settings → API Keys → Create API
        key). It's only ever sent to api.app.stape.io as the X-AUTH-TOKEN header.
      </div>
      {error && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>}

      <input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="Stape API key"
        className="mono"
        style={{ background: 'var(--bg)', color: 'var(--line-primary)', border: '1px solid var(--line-ghost)', padding: 8, borderRadius: 2 }}
      />

      <select
        value={region}
        onChange={(e) => setRegion(e.target.value as 'global' | 'eu')}
        style={{ background: 'var(--bg)', color: 'var(--line-primary)', border: '1px solid var(--line-ghost)', padding: 8, borderRadius: 2 }}
      >
        <option value="global">Global (api.app.stape.io)</option>
        <option value="eu">EU (api.app.eu.stape.io)</option>
      </select>

      <button className="btn btn-accent" disabled={!apiKey || saving} onClick={save}>
        {saving ? 'Verifying…' : 'Connect Stape'}
      </button>
      {saved && <div style={{ fontSize: 12, color: 'var(--accent)' }}>Saved. Refresh to confirm.</div>}
    </div>
  );
}
