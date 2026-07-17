import { google } from 'googleapis';
import { callLogged, type LogCallContext } from '@/lib/integration-log';
import { ga4ClientFromRefreshToken } from './oauth';

export class Ga4Error extends Error {
  plainEnglish: string;
  status?: number;
  constructor(message: string, plainEnglish: string, status?: number) {
    super(message);
    this.plainEnglish = plainEnglish;
    this.status = status;
  }
}

function translateError(err: unknown): Ga4Error {
  const anyErr = err as { response?: { status?: number; data?: { error?: { message?: string } } }; code?: number; message?: string };
  const status = anyErr?.response?.status ?? anyErr?.code;
  const rawMessage = anyErr?.response?.data?.error?.message ?? anyErr?.message ?? 'Unknown GA4 API error';

  if (status === 403) {
    return new Ga4Error(
      rawMessage,
      "Your Google account doesn't have Edit access on this GA4 property. Ask the property admin to grant you the Editor role, then try again.",
      403,
    );
  }
  if (status === 429) {
    return new Ga4Error(rawMessage, 'Google Analytics is rate-limiting these requests. Wait a minute and try again.', 429);
  }
  if (status === 401) {
    return new Ga4Error(
      rawMessage,
      'Your Google Analytics connection has expired or been revoked. Reconnect it from Settings and try again.',
      401,
    );
  }
  if (status === 404) {
    return new Ga4Error(rawMessage, "That GA4 property, stream, or event couldn't be found — it may have been deleted or moved.", 404);
  }
  return new Ga4Error(rawMessage, `Google Analytics returned an unexpected error: ${rawMessage}`, typeof status === 'number' ? status : undefined);
}

export type Ga4CallContext = LogCallContext;

// Wraps the shared logger (lib/integration-log.ts) with GA4-specific error
// translation — the log row keeps the raw error, callers get the
// plain-English one.
export async function callGa4Logged<T>(
  context: Ga4CallContext,
  method: string,
  endpoint: string,
  requestBody: unknown,
  fn: () => Promise<{ data: T; status?: number }>,
): Promise<T> {
  try {
    return await callLogged('ga4', context, method, endpoint, requestBody, fn);
  } catch (err) {
    throw translateError(err);
  }
}

export function getAnalyticsAdminClient(refreshToken: string) {
  const auth = ga4ClientFromRefreshToken(refreshToken);
  return google.analyticsadmin({ version: 'v1beta', auth });
}

export function getAnalyticsDataClient(refreshToken: string) {
  const auth = ga4ClientFromRefreshToken(refreshToken);
  return google.analyticsdata({ version: 'v1beta', auth });
}

export function getBigQueryClient(refreshToken: string) {
  const auth = ga4ClientFromRefreshToken(refreshToken);
  return google.bigquery({ version: 'v2', auth });
}
