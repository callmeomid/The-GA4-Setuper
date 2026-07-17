import { google } from 'googleapis';

// A third, separate OAuth grant (sign-in and GTM are the other two — see
// lib/gtm/oauth.ts for why these stay split). analytics.edit is broader than
// we'd like — GA4's Admin API has no scope narrower than "edit everything on
// this property" the way tagmanager.edit.containers at least confines GTM to
// containers — but conversionEvents.create requires it; there is no
// conversionEvents-only scope to request instead. bigquery.readonly is only
// exercised if the funnel's validation method is "bigquery"; requesting it
// upfront avoids a fourth OAuth grant just for that one optional path.
export const GA4_SCOPES = [
  'https://www.googleapis.com/auth/analytics.edit',
  'https://www.googleapis.com/auth/analytics.readonly',
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
