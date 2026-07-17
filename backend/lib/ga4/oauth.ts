import { google } from 'googleapis';

// analytics.edit is the least-scoped grant that can create conversion events
// and Measurement Protocol secrets. Unlike GTM there is no separate
// "analytics.publish" scope to withhold — the GA4 Admin API has no
// draft/publish concept, so anything this connection writes is live on the
// real property the moment the call succeeds. That's surfaced in the preview
// UI, not hidden behind scope selection the way GTM's publish-gate is.
//
// bigquery.readonly is bundled in here rather than behind its own
// incremental grant: it exists solely to let the validation step read back
// the BigQuery export this same connection can already see the existence of
// (via analyticsadmin's bigQueryLinks), and it's read-only — no write/delete
// surface is added by holding it.
export const GA4_SCOPES = [
  'https://www.googleapis.com/auth/analytics.edit',
  'https://www.googleapis.com/auth/bigquery.readonly',
];

function redirectUri() {
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  return `${base}/api/ga4/callback`;
}

export function createGa4OAuthClient() {
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri());
}

export function getGa4AuthorizationUrl(state: string) {
  return createGa4OAuthClient().generateAuthUrl({
    access_type: 'offline',
    // Forces Google to return a refresh_token even on a repeat consent —
    // otherwise reconnecting after a revoke silently fails, same as GTM.
    prompt: 'consent',
    scope: GA4_SCOPES,
    state,
  });
}

export async function exchangeGa4Code(code: string) {
  const client = createGa4OAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export function ga4ClientFromRefreshToken(refreshToken: string) {
  const client = createGa4OAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}
