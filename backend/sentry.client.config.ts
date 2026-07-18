// Loaded automatically by the Sentry Next.js webpack plugin on the browser
// bundle. Covers React rendering errors in the dashboard/funnel/ops UI —
// the third-party API calls themselves never run in the browser (they're
// server-side, see sentry.server.config.ts).
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
