import { google } from 'googleapis';
import { logApiCall, type ApiCallContext } from '@/lib/apiLog';
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

  if (/maximum number of conversion events|quota|RESOURCE_EXHAUSTED/i.test(rawMessage)) {
    return new Ga4Error(
      rawMessage,
      "This GA4 property is at (or near) Google's cap on custom conversion events. Free up a slot in GA4 (Admin → Events → turn off \"Mark as conversion\" on one you don't need) and try again.",
      status,
    );
  }
  if (status === 403) {
    return new Ga4Error(
      rawMessage,
      "Your Google account doesn't have Editor access to this GA4 property. Ask the property owner to grant you Editor access in GA4 Admin, then try again.",
      403,
    );
  }
  if (status === 429) {
    return new Ga4Error(rawMessage, 'The GA4 Admin API is rate-limiting these requests. Wait a minute and try again.', 429);
  }
  if (status === 401) {
    return new Ga4Error(rawMessage, 'Your GA4 connection has expired or been revoked. Reconnect it from Settings and try again.', 401);
  }
  if (status === 404) {
    return new Ga4Error(rawMessage, "That GA4 property or resource couldn't be found — it may have been deleted or moved.", 404);
  }
  return new Ga4Error(rawMessage, `The GA4 Admin API returned an unexpected error: ${rawMessage}`, typeof status === 'number' ? status : undefined);
}

export type Ga4CallContext = ApiCallContext;

// Every GA4 Admin/Data API call in this app goes through here, mirroring
// lib/gtm/client.ts's callGtmLogged — same "nothing calls the raw client
// directly" guarantee, same ApiLog trail, tagged system: "ga4".
export async function callGa4Logged<T>(
  context: Ga4CallContext,
  method: string,
  endpoint: string,
  requestBody: unknown,
  fn: () => Promise<{ data: T; status?: number }>,
): Promise<T> {
  const start = Date.now();
  try {
    const res = await fn();
    await logApiCall('ga4', context, method, endpoint, requestBody, { status: res.status ?? 200, responseBody: res.data }, Date.now() - start);
    return res.data;
  } catch (err) {
    const translated = translateError(err);
    await logApiCall('ga4', context, method, endpoint, requestBody, { status: translated.status ?? null, errorMessage: translated.message }, Date.now() - start);
    throw translated;
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
