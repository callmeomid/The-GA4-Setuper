'use client';

import { useEffect, useState } from 'react';

type Account = { accountId: string; name: string };
type Container = { containerId: string; name: string; publicId: string };

export function GtmConnectPanel({
  connected,
  selectedContainerName,
}: {
  connected: boolean;
  selectedContainerName: string | null;
}) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [accountId, setAccountId] = useState('');
  const [containerId, setContainerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!connected) return;
    setLoading(true);
    fetch('/api/gtm/accounts')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setAccounts(data.accounts ?? []);
      })
      .finally(() => setLoading(false));
  }, [connected]);

  useEffect(() => {
    if (!accountId) {
      setContainers([]);
      return;
    }
    setLoading(true);
    fetch(`/api/gtm/accounts?accountId=${encodeURIComponent(accountId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setContainers(data.containers ?? []);
      })
      .finally(() => setLoading(false));
  }, [accountId]);

  async function save() {
    const container = containers.find((c) => c.containerId === containerId);
    const res = await fetch('/api/gtm/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, containerId, containerPublicId: container?.publicId }),
    });
    if (res.ok) {
      setSaved(true);
      setEditing(false);
    }
  }

  if (!connected) {
    return (
      <a href="/api/gtm/connect" className="btn btn-accent" style={{ textDecoration: 'none', display: 'inline-block' }}>
        Connect Google Tag Manager
      </a>
    );
  }

  if (selectedContainerName && !saved && !editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="mono" style={{ fontSize: 12, color: 'var(--line-secondary)' }}>
          Connected — writing to <span style={{ color: 'var(--accent)' }}>{selectedContainerName}</span>
        </div>
        <button
          className="btn"
          style={{ padding: '4px 10px', fontSize: 10.5 }}
          onClick={() => {
            setAccountId('');
            setContainerId('');
            setEditing(true);
          }}
        >
          Change container
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
      <div className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)' }}>
        {loading ? 'Loading…' : 'Choose which GTM container to write to.'}
      </div>
      {error && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>}

      <select
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
        style={{ background: 'var(--bg)', color: 'var(--line-primary)', border: '1px solid var(--line-ghost)', padding: 8, borderRadius: 2 }}
      >
        <option value="">Select GTM account…</option>
        {accounts.map((a) => (
          <option key={a.accountId} value={a.accountId}>
            {a.name}
          </option>
        ))}
      </select>

      {accountId && (
        <select
          value={containerId}
          onChange={(e) => setContainerId(e.target.value)}
          style={{ background: 'var(--bg)', color: 'var(--line-primary)', border: '1px solid var(--line-ghost)', padding: 8, borderRadius: 2 }}
        >
          <option value="">Select container…</option>
          {containers.map((c) => (
            <option key={c.containerId} value={c.containerId}>
              {c.name} ({c.publicId})
            </option>
          ))}
        </select>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {containerId && (
          <button className="btn btn-accent" onClick={save}>
            Use this container
          </button>
        )}
        {selectedContainerName && !saved && (
          <button className="btn" onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
      </div>
      {saved && <div style={{ fontSize: 12, color: 'var(--accent)' }}>Saved. Refresh to confirm.</div>}
    </div>
  );
}
