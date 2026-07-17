'use client';

import { useEffect, useState } from 'react';

type Property = { propertyId: string; displayName: string; accountName: string };

export function Ga4ConnectPanel({
  connected,
  selectedPropertyDisplayName,
}: {
  connected: boolean;
  selectedPropertyDisplayName: string | null;
}) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!connected) return;
    setLoading(true);
    fetch('/api/ga4/properties')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setProperties(data.properties ?? []);
      })
      .finally(() => setLoading(false));
  }, [connected]);

  async function save() {
    const property = properties.find((p) => p.propertyId === propertyId);
    const res = await fetch('/api/ga4/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId, propertyDisplayName: property?.displayName }),
    });
    if (res.ok) setSaved(true);
  }

  if (!connected) {
    return (
      <a href="/api/ga4/connect" className="btn btn-accent" style={{ textDecoration: 'none', display: 'inline-block' }}>
        Connect Google Analytics
      </a>
    );
  }

  if (selectedPropertyDisplayName && !saved) {
    return (
      <div className="mono" style={{ fontSize: 12, color: 'var(--line-secondary)' }}>
        Connected — writing to <span style={{ color: 'var(--accent)' }}>{selectedPropertyDisplayName}</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
      <div className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)' }}>
        {loading ? 'Loading…' : 'Choose which GA4 property to write to.'}
      </div>
      {error && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>}

      <select
        value={propertyId}
        onChange={(e) => setPropertyId(e.target.value)}
        style={{ background: 'var(--bg)', color: 'var(--line-primary)', border: '1px solid var(--line-ghost)', padding: 8, borderRadius: 2 }}
      >
        <option value="">Select GA4 property…</option>
        {properties.map((p) => (
          <option key={p.propertyId} value={p.propertyId}>
            {p.accountName} / {p.displayName} ({p.propertyId})
          </option>
        ))}
      </select>

      {propertyId && (
        <button className="btn btn-accent" onClick={save}>
          Use this property
        </button>
      )}
      {saved && <div style={{ fontSize: 12, color: 'var(--accent)' }}>Saved. Refresh to confirm.</div>}
    </div>
  );
}
