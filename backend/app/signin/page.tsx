'use client';

import { signIn } from 'next-auth/react';

export default function SignInPage() {
  return (
    <main
      className="dot-grid"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          border: '1px solid var(--line-ghost)',
          borderRadius: 2,
          padding: '32px 28px',
          width: 320,
          background: 'var(--bg-raised)',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <span className="mono" style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--line-secondary)' }}>
          FUNNEL SETUPER
        </span>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--line-secondary)', lineHeight: 1.5 }}>
          Sign in to review funnels captured from your site.
        </p>
        <button
          className="btn btn-accent"
          style={{ width: '100%' }}
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
        >
          Sign in with Google
        </button>
      </div>
    </main>
  );
}
