'use client';

import { useState } from 'react';

export function StapeConnectPanel({ connected }: { connected: boolean }) {
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/stape/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? 'Could not save API key.');
      else {
        setSaved(true);
        setApiKey('');
      }
    } catch {
      setError('Could not save API key — network error.');
    } finally {
      setSaving(false);
    }
  }

  if (connected && !saved) {
    return (
      <div className="mono" style={{ fontSize: 12, color: 'var(--accent)' }}>
        API key saved. Paste a new one below to replace it.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          type="password"
          placeholder="Stape API key"
          className="mono"
          style={{ flex: 1, background: 'var(--bg)', color: 'var(--line-primary)', border: '1px solid var(--line-ghost)', padding: 8, borderRadius: 2 }}
        />
        <button className="btn btn-accent btn-small" disabled={saving || !apiKey} onClick={save}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
      {saved && <div style={{ fontSize: 12, color: 'var(--accent)' }}>Saved.</div>}
    </div>
  );
}
