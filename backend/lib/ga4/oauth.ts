import { google } from 'googleapis';

// A separate grant from both sign-in and the GTM connection — read-only, and
// only used to check whether an event actually arrived (lib/ga4/api.ts). It
// can never modify anything in GA4.
export const GA4_SCOPES = ['https://www.googleapis.com/auth/analytics.readonly'];

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
