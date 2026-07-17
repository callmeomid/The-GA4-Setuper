import { google } from 'googleapis';
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
      "Your Google account doesn't have access to this GA4 property. Ask the property owner to add you as at least a Viewer, then try again.",
      403,
    );
  }
  if (status === 429) {
    return new Ga4Error(rawMessage, 'GA4 is rate-limiting these requests. Wait a minute and try again.', 429);
  }
  if (status === 401) {
    return new Ga4Error(rawMessage, 'Your GA4 connection has expired or been revoked. Reconnect it from Settings and try again.', 401);
  }
  if (status === 404) {
    return new Ga4Error(rawMessage, "That GA4 property couldn't be found — it may have been deleted or moved.", 404);
  }
  return new Ga4Error(rawMessage, `GA4 returned an unexpected error: ${rawMessage}`, typeof status === 'number' ? status : undefined);
}

export async function callGa4<T>(fn: () => Promise<{ data: T }>): Promise<T> {
  try {
    const res = await fn();
    return res.data;
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
