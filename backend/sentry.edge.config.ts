// Loaded by instrumentation.ts on the Edge runtime (middleware, if any is
// added later). No middleware.ts exists yet, but next-auth and Next itself
// can route some requests through the edge runtime, so this stays in sync
// with sentry.server.config.ts rather than leaving that path uninstrumented.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
