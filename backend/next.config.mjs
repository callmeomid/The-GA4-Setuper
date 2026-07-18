import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only upload source maps (and touch the Sentry API at build time) when an
  // auth token is actually configured — keeps local/CI builds without Sentry
  // set up from failing or generating noise.
  silent: true,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  disableLogger: true,
  telemetry: false,
});
