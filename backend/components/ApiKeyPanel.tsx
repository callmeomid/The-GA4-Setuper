'use client';

import { useState } from 'react';

export function ApiKeyPanel({ apiKey }: { apiKey: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 16, marginBottom: 24 }}>
      <div className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        API key
      </div>
      <p style={{ fontSize: 13, color: 'var(--line-secondary)', marginTop: 0, marginBottom: 12, lineHeight: 1.5 }}>
        Paste this into the Chrome extension's sidepanel so it can send captured funnels to your account.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          readOnly
          value={apiKey}
          onFocus={(e) => e.currentTarget.select()}
          className="mono"
          style={{
            flex: 1,
            fontSize: 12.5,
            padding: '8px 10px',
            border: '1px solid var(--line-ghost)',
            borderRadius: 2,
            background: 'var(--bg-raised)',
            color: 'inherit',
          }}
        />
        <button className="btn" style={{ flex: 'none' }} onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
