import { google } from 'googleapis';
import { logError } from '@/lib/log';
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

// runId groups every call made during one gtm-push execution (see
// app/api/funnels/[id]/gtm-push/route.ts) so the ops dashboard and the
// rollback path can answer "what did this run touch" directly from
// IntegrationApiLog instead of re-deriving it from timestamps.
export type GtmCallContext = { funnelId?: string; userId?: string; runId?: string };

// Every GTM API call in this app goes through here, so every call — success
// or failure — leaves a row in IntegrationApiLog with the request, response,
// status, and duration, and every failure also reaches Sentry with that same
// context attached. Nothing calls the raw client directly.
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
    await prisma.integrationApiLog.create({
      data: {
        provider: 'gtm',
        funnelId: context.funnelId ?? null,
        userId: context.userId ?? null,
        runId: context.runId ?? null,
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
    await prisma.integrationApiLog.create({
      data: {
        provider: 'gtm',
        funnelId: context.funnelId ?? null,
        userId: context.userId ?? null,
        runId: context.runId ?? null,
        method,
        endpoint,
        requestBody: truncate(requestBody),
        responseStatus: translated.status ?? null,
        errorMessage: truncate(translated.message),
        durationMs: Date.now() - start,
      },
    });
    logError(`GTM API call failed: ${method} ${endpoint}`, translated, {
      provider: 'gtm',
      method,
      endpoint,
      status: translated.status,
      funnelId: context.funnelId,
      userId: context.userId,
      runId: context.runId,
    });
    throw translated;
  }
}

export function getTagmanagerClient(refreshToken: string) {
  const auth = gtmClientFromRefreshToken(refreshToken);
  return google.tagmanager({ version: 'v2', auth });
}
