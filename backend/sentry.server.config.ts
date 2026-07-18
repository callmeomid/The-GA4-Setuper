// Loaded by instrumentation.ts on the Node runtime. Captures every unhandled
// exception in API routes and server components, plus anything we report
// manually via lib/log.ts — request/response bodies for third-party calls
// live in IntegrationApiLog, not here; this is for "something is broken,
// page a human," not payload inspection.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  // No DSN (local dev without Sentry configured) -> SDK silently no-ops.
});
