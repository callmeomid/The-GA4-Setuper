'use client';

import { useEffect, useState } from 'react';

type Property = { propertyId: string; displayName: string; accountName: string };
type Stream = { streamId: string; displayName: string; measurementId: string; defaultUri: string | null };

export function Ga4ConnectPanel({
  connected,
  selectedPropertyName,
  selectedMeasurementId,
}: {
  connected: boolean;
  selectedPropertyName: string | null;
  selectedMeasurementId: string | null;
}) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [streamId, setStreamId] = useState('');
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

  useEffect(() => {
    if (!propertyId) {
      setStreams([]);
      return;
    }
    setLoading(true);
    fetch(`/api/ga4/properties?propertyId=${encodeURIComponent(propertyId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setStreams(data.streams ?? []);
      })
      .finally(() => setLoading(false));
  }, [propertyId]);

  async function save() {
    const property = properties.find((p) => p.propertyId === propertyId);
    const stream = streams.find((s) => s.streamId === streamId);
    if (!stream) return;
    const res = await fetch('/api/ga4/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId, propertyName: property?.displayName, measurementId: stream.measurementId }),
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

  if (selectedPropertyName && !saved) {
    return (
      <div className="mono" style={{ fontSize: 12, color: 'var(--line-secondary)' }}>
        Connected — using <span style={{ color: 'var(--accent)' }}>{selectedPropertyName}</span>
        {selectedMeasurementId && <span> ({selectedMeasurementId})</span>}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
      <div className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)' }}>
        {loading ? 'Loading…' : 'Choose which GA4 property to validate against.'}
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
            {p.accountName} — {p.displayName}
          </option>
        ))}
      </select>

      {propertyId && (
        <select
          value={streamId}
          onChange={(e) => setStreamId(e.target.value)}
          style={{ background: 'var(--bg)', color: 'var(--line-primary)', border: '1px solid var(--line-ghost)', padding: 8, borderRadius: 2 }}
        >
          <option value="">Select web data stream…</option>
          {streams.map((s) => (
            <option key={s.streamId} value={s.streamId}>
              {s.displayName} ({s.measurementId})
            </option>
          ))}
        </select>
      )}

      {propertyId && streams.length === 0 && !loading && (
        <div style={{ fontSize: 11.5, color: 'var(--line-secondary)' }}>
          No web data streams found on this property — add one in GA4 under Admin → Data Streams.
        </div>
      )}

      {streamId && (
        <button className="btn btn-accent" onClick={save}>
          Use this property
        </button>
      )}
      {saved && <div style={{ fontSize: 12, color: 'var(--accent)' }}>Saved. Refresh to confirm.</div>}
    </div>
  );
}
