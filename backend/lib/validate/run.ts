import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { bigQueryDefaultDataset, bigQueryFindValidationEvent, runRealtimeEventCount } from '@/lib/ga4/api';
import { deriveEventName } from '@/lib/gtm/event-name';

export type ValidationMethod = 'bigquery' | 'realtime' | 'debugview';

export class ValidationError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function loadFunnelForValidation(userId: string, funnelId: string) {
  const funnel = await prisma.funnel.findUnique({ where: { id: funnelId }, include: { steps: { orderBy: { order: 'asc' } } } });
  if (!funnel || funnel.ownerId !== userId) throw new ValidationError('Funnel not found', 404);
  if (funnel.status !== 'approved') throw new ValidationError('Approve this funnel before validating it.', 400);
  return funnel;
}

export async function loadGa4ConnectionForValidation(userId: string) {
  const connection = await prisma.ga4Connection.findUnique({ where: { userId } });
  if (!connection?.ga4PropertyId) throw new ValidationError('Connect Google Analytics and select a property in Settings first.', 400);
  return connection as typeof connection & { ga4PropertyId: string };
}

// How long a "pending" bigquery/realtime check is allowed to stay pending
// before we call it a fail. BigQuery's streaming buffer is usually seconds
// to a couple of minutes but isn't guaranteed fast, so it gets a longer
// window than realtime reporting (which is genuinely near-real-time).
const TIMEOUT_MS: Record<'bigquery' | 'realtime', number> = {
  bigquery: 10 * 60 * 1000,
  realtime: 3 * 60 * 1000,
};

type FireStepInput = { id: string; order: number; label: string; ga4EventName: string | null };

export function eventNameForStep(step: FireStepInput): string {
  return step.ga4EventName ?? deriveEventName(step.label);
}

export async function checkPendingResult(
  ctx: { userId: string; funnelId: string },
  refreshToken: string,
  method: 'bigquery' | 'realtime',
  propertyPath: string,
  bigQuery: { projectId: string; datasetId: string | null } | null,
  result: { id: string; eventName: string; validationId: string; createdAt: Date },
) {
  const ageMs = Date.now() - new Date(result.createdAt).getTime();

  try {
    let found = false;
    if (method === 'bigquery') {
      if (!bigQuery?.projectId) throw new ValidationError('No BigQuery project configured for this funnel.', 400);
      const datasetId = bigQuery.datasetId || bigQueryDefaultDataset(propertyPath);
      found = await bigQueryFindValidationEvent(ctx, refreshToken, bigQuery.projectId, datasetId, result.eventName, result.validationId);
    } else {
      const count = await runRealtimeEventCount(ctx, refreshToken, propertyPath, result.eventName);
      found = count > 0;
    }

    if (found) return { outcome: 'pass' as const, detail: null };
    if (ageMs > TIMEOUT_MS[method]) {
      return { outcome: 'fail' as const, detail: `Not seen within ${Math.round(TIMEOUT_MS[method] / 60000)} minutes of firing.` };
    }
    return { outcome: 'pending' as const, detail: null };
  } catch (err) {
    const plainEnglish = (err as { plainEnglish?: string }).plainEnglish;
    const detail = plainEnglish ?? (err instanceof Error ? err.message : 'Unknown error checking this step.');
    if (ageMs > TIMEOUT_MS[method]) return { outcome: 'error' as const, detail };
    return { outcome: 'pending' as const, detail };
  }
}

export function newValidationId() {
  return crypto.randomUUID();
}

export function debugViewUrl(propertyPath: string) {
  const numericId = propertyPath.replace('properties/', '');
  return `https://analytics.google.com/analytics/web/#/p${numericId}/debugview/overview`;
}
