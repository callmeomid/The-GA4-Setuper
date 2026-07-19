'use client';

import Link from 'next/link';
import { useState } from 'react';

const steps = [
  {
    title: 'Load the Chrome extension',
    body: "In Chrome, go to chrome://extensions, turn on Developer mode, then \"Load unpacked\" and select this project's extension/ folder.",
  },
  {
    title: 'Connect it to your account',
    body: 'Open the extension\'s side panel and paste your API key from Settings below into its "Backend API key" field.',
  },
  {
    title: 'Record a funnel',
    body: 'Click Start recording in the side panel, then walk through your site — every click, pageview, and form submit becomes a step.',
  },
  {
    title: 'Review, approve, push to GTM',
    body: 'Sent funnels show up right here. Review the flow, approve it, then push it to a draft GTM workspace — nothing publishes automatically.',
  },
];

export function OnboardingPanel({ apiKey }: { apiKey: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  async function dismiss() {
    setDismissing(true);
    try {
      await fetch('/api/onboarding/dismiss', { method: 'POST' });
    } finally {
      setDismissed(true);
      setDismissing(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (dismissed) return null;

  return (
    <div
      className="dot-grid"
      style={{
        border: '1px solid var(--accent)',
        borderRadius: 2,
        padding: '20px 20px 16px',
        marginBottom: 24,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Welcome — here's how this works</h2>
        <button className="btn" style={{ padding: '4px 10px', fontSize: 10.5, flex: 'none' }} disabled={dismissing} onClick={dismiss}>
          {dismissing ? 'Closing…' : 'Got it'}
        </button>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--line-secondary)', marginTop: 4, marginBottom: 16 }}>
        Funnels aren't created here — they're recorded by the Chrome extension, then sent to this dashboard.
      </p>

      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {steps.map((step, i) => (
          <li key={step.title} style={{ display: 'flex', gap: 10 }}>
            <span
              className="mono"
              style={{
                flex: 'none',
                width: 20,
                height: 20,
                borderRadius: '50%',
                border: '1px solid var(--accent)',
                color: 'var(--accent)',
                fontSize: 10.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {i + 1}
            </span>
            <div>
              <div style={{ fontSize: 13, marginBottom: 2 }}>{step.title}</div>
              <div style={{ fontSize: 12, color: 'var(--line-secondary)', lineHeight: 1.5 }}>{step.body}</div>
              {i === 1 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, maxWidth: 360 }}>
                  <input
                    readOnly
                    value={apiKey}
                    onFocus={(e) => e.currentTarget.select()}
                    className="mono"
                    style={{
                      flex: 1,
                      fontSize: 11.5,
                      padding: '6px 8px',
                      border: '1px solid var(--line-ghost)',
                      borderRadius: 2,
                      background: 'var(--bg-raised)',
                      color: 'inherit',
                    }}
                  />
                  <button className="btn" style={{ flex: 'none', padding: '5px 10px', fontSize: 10.5 }} onClick={copy}>
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      <p style={{ fontSize: 11.5, color: 'var(--line-secondary)', marginTop: 16, marginBottom: 0 }}>
        Also connect Google Tag Manager in{' '}
        <Link href="/settings" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
          Settings
        </Link>{' '}
        before pushing a funnel — that's a separate permission from signing in.
      </p>
    </div>
  );
}
