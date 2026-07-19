import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { gtmClientFromRefreshToken } from './oauth';

export class GtmError extends Error {
  plainEnglish: string;
  status?: number;
  constructor(message: string, plainEnglish: string, status?: number) {
    super(message);
    this.plainEnglish = plainEnglish;
    this.status = status;
  }
}

function translateError(err: unknown): GtmError {
  const anyErr = err as { response?: { status?: number; data?: { error?: { message?: string } } }; code?: number; message?: string };
  const status = anyErr?.response?.status ?? anyErr?.code;
  const rawMessage = anyErr?.response?.data?.error?.message ?? anyErr?.message ?? 'Unknown GTM API error';

  // Free GTM accounts cap out at 3 workspaces per container (the default plus
  // 2 more); GTM 360 has no cap. This app creates one dedicated workspace per
  // funnel, so a marketer testing a handful of funnels hits this fast — and
  // the raw API error is just a generic 400, so it needs its own translation
  // or it's indistinguishable from any other validation failure.
  if (status === 400 && /number of workspaces|workspace.*limit|too many workspaces/i.test(rawMessage)) {
    return new GtmError(
      rawMessage,
      'This GTM container already has the maximum number of workspaces (3 on a free account). Delete or merge an old workspace in Tag Manager — Admin → Workspaces — then try again, or upgrade to GTM 360 for unlimited workspaces.',
      400,
    );
  }
  if (status === 403) {
    return new GtmError(
      rawMessage,
      "Your Google account doesn't have edit access to this GTM container. Ask the container owner to grant you Edit permission in GTM, then try again.",
      403,
    );
  }
  if (status === 429) {
    return new GtmError(rawMessage, 'Google Tag Manager is rate-limiting these requests. Wait a minute and try again.', 429);
  }
  if (status === 401) {
    return new GtmError(
      rawMessage,
      'Your Google Tag Manager connection has expired or been revoked. Reconnect it from Settings and try again.',
      401,
    );
  }
  if (status === 404) {
    return new GtmError(rawMessage, "That GTM container, workspace, or item couldn't be found — it may have been deleted or moved.", 404);
  }
  return new GtmError(rawMessage, `Google Tag Manager returned an unexpected error: ${rawMessage}`, typeof status === 'number' ? status : undefined);
}

function truncate(value: unknown, max = 4000): string {
  const s = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return s.length > max ? `${s.slice(0, max)}… (truncated)` : s;
}

export type GtmCallContext = { funnelId?: string; userId?: string };

// Every GTM API call in this app goes through here, so every call — success
// or failure — leaves a row in GtmApiLog with the request, response, status,
// and duration. Nothing calls the raw client directly.
export async function callGtmLogged<T>(
  context: GtmCallContext,
  method: string,
  endpoint: string,
  requestBody: unknown,
  fn: () => Promise<{ data: T; status?: number }>,
): Promise<T> {
  const start = Date.now();
  try {
    const res = await fn();
    await prisma.gtmApiLog.create({
      data: {
        funnelId: context.funnelId ?? null,
        userId: context.userId ?? null,
        method,
        endpoint,
        requestBody: truncate(requestBody),
        responseStatus: res.status ?? 200,
        responseBody: truncate(res.data),
        durationMs: Date.now() - start,
      },
    });
    return res.data;
  } catch (err) {
    const translated = translateError(err);
    await prisma.gtmApiLog.create({
      data: {
        funnelId: context.funnelId ?? null,
        userId: context.userId ?? null,
        method,
        endpoint,
        requestBody: truncate(requestBody),
        responseStatus: translated.status ?? null,
        errorMessage: truncate(translated.message),
        durationMs: Date.now() - start,
      },
    });
    throw translated;
  }
}

export function getTagmanagerClient(refreshToken: string) {
  const auth = gtmClientFromRefreshToken(refreshToken);
  return google.tagmanager({ version: 'v2', auth });
}
