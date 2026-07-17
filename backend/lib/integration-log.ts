import { prisma } from '@/lib/prisma';

export type IntegrationSystem = 'ga4' | 'stape';
export type LogCallContext = { funnelId?: string; userId?: string };

export function truncate(value: unknown, max = 4000): string {
  const s = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return s.length > max ? `${s.slice(0, max)}… (truncated)` : s;
}

// Shared by lib/ga4/client.ts and lib/stape/client.ts — every call either of
// those integrations makes leaves a row here, success or failure, mirroring
// how lib/gtm/client.ts's callGtmLogged works for GTM. Logs the *raw* error
// (technical, useful in the log viewer) and rethrows it unmodified — each
// system's own client.ts wraps this and translates the error into its
// plain-English form for the UI, same two-layer split GTM uses.
export async function callLogged<T>(
  system: IntegrationSystem,
  context: LogCallContext,
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
        system,
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
    const status = (err as { response?: { status?: number }; code?: number; status_?: number }).response?.status
      ?? (err as { code?: number }).code;
    const message = err instanceof Error ? err.message : String(err);
    await prisma.integrationApiLog.create({
      data: {
        system,
        funnelId: context.funnelId ?? null,
        userId: context.userId ?? null,
        method,
        endpoint,
        requestBody: truncate(requestBody),
        responseStatus: typeof status === 'number' ? status : null,
        errorMessage: truncate(message),
        durationMs: Date.now() - start,
      },
    });
    throw err;
  }
}
