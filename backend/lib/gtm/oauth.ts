import { google } from 'googleapis';

// Deliberately excludes tagmanager.publish — this app never requests the
// scope that would let it publish a container, so "never auto-publish" is
// enforced by the token itself, not just by which endpoints the code calls.
export const GTM_SCOPES = [
  'https://www.googleapis.com/auth/tagmanager.readonly',
  'https://www.googleapis.com/auth/tagmanager.edit.containers',
];

function redirectUri() {
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  return `${base}/api/gtm/callback`;
}

export function createGtmOAuthClient() {
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri());
}

export function getGtmAuthorizationUrl(state: string) {
  return createGtmOAuthClient().generateAuthUrl({
    access_type: 'offline',
    // Forces Google to return a refresh_token even if the user connected
    // before — otherwise a reconnect after revoking access silently fails.
    prompt: 'consent',
    scope: GTM_SCOPES,
    state,
  });
}

export async function exchangeGtmCode(code: string) {
  const client = createGtmOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export function gtmClientFromRefreshToken(refreshToken: string) {
  const client = createGtmOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}
