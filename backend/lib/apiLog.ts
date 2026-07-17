import { prisma } from '@/lib/prisma';

export type ApiCallContext = { funnelId?: string; userId?: string };

function truncate(value: unknown, max = 4000): string {
  const s = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return s.length > max ? `${s.slice(0, max)}… (truncated)` : s;
}

// Shared by lib/gtm/client.ts, lib/ga4/client.ts, and lib/stape/client.ts —
// every third-party API call this app makes, success or failure, leaves one
// ApiLog row so it stays inspectable after the fact. `system` is what the
// log viewer filters on.
export async function logApiCall(
  system: 'gtm' | 'ga4' | 'stape',
  context: ApiCallContext,
  method: string,
  endpoint: string,
  requestBody: unknown,
  outcome: { status?: number | null; responseBody?: unknown; errorMessage?: string } ,
  durationMs: number,
) {
  await prisma.apiLog.create({
    data: {
      system,
      funnelId: context.funnelId ?? null,
      userId: context.userId ?? null,
      method,
      endpoint,
      requestBody: truncate(requestBody),
      responseStatus: outcome.status ?? null,
      responseBody: outcome.responseBody !== undefined ? truncate(outcome.responseBody) : null,
      errorMessage: outcome.errorMessage ? truncate(outcome.errorMessage) : null,
      durationMs,
    },
  });
}
