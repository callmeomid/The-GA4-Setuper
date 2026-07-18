'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

// App Router only calls this for errors that escape every nested error
// boundary, so it has to render its own <html>/<body> — there's no parent
// layout left standing to fall back on.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: '#0A0B0D', color: '#E8E9EA', fontFamily: 'Inter, sans-serif', padding: 32 }}>
        <p style={{ fontSize: 14 }}>Something broke. It's been reported — try reloading.</p>
      </body>
    </html>
  );
}
