'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function StapeSubdomainForm({ funnelId, initialValue }: { funnelId: string; initialValue: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/funnels/${funnelId}/stape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain: value.trim() }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400 }}>
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        placeholder="sgtm.yoursite.com"
        className="mono"
        style={{ background: 'var(--bg)', color: 'var(--line-primary)', border: '1px solid var(--line-ghost)', padding: 8, borderRadius: 2 }}
      />
      <button className="btn btn-accent" disabled={saving || !value.trim()} onClick={save} style={{ alignSelf: 'flex-start' }}>
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Use this subdomain'}
      </button>
    </div>
  );
}
