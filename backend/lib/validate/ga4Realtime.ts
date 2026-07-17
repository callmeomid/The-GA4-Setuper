import { logApiCall, type ApiCallContext } from '@/lib/apiLog';
import { getAnalyticsDataClient } from '@/lib/ga4/client';

// The Realtime API confirms an event NAME landed in the last few minutes —
// it can't filter on our validation_run_id (that would need a registered
// custom dimension, which itself takes hours to start populating), so this
// is "events like this are flowing right now," not "this exact test hit
// landed." lib/validate/bigQuery.ts is the exact-match check when available;
// this is the fast, always-available fallback.
export async function countRecentRealtimeEvents(
  ctx: ApiCallContext,
  refreshToken: string,
  propertyId: string,
  eventName: string,
): Promise<number> {
  const data = getAnalyticsDataClient(refreshToken);
  const start = Date.now();
  const requestBody = {
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: { fieldName: 'eventName', stringFilter: { value: eventName, matchType: 'EXACT' as const } },
    },
    minuteRanges: [{ name: 'validationWindow', startMinutesAgo: 5, endMinutesAgo: 0 }],
  };
  try {
    const res = await data.properties.runRealtimeReport({ property: `properties/${propertyId}`, requestBody });
    await logApiCall(
      'ga4',
      ctx,
      'POST',
      'runRealtimeReport',
      requestBody,
      { status: res.status ?? 200, responseBody: res.data },
      Date.now() - start,
    );
    const rows = res.data.rows ?? [];
    return rows.reduce((sum, row) => sum + Number(row.metricValues?.[0]?.value ?? 0), 0);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error calling runRealtimeReport';
    await logApiCall('ga4', ctx, 'POST', 'runRealtimeReport', requestBody, { errorMessage: message }, Date.now() - start);
    throw err;
  }
}

export async function pollRealtimeForEvent(
  ctx: ApiCallContext,
  refreshToken: string,
  propertyId: string,
  eventName: string,
  attempts = 3,
  delayMs = 4000,
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const count = await countRecentRealtimeEvents(ctx, refreshToken, propertyId, eventName);
    if (count > 0) return true;
    if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}

// Batched form used by the validation orchestrator so an N-step funnel costs
// one runRealtimeReport call per poll attempt instead of N.
export async function countRecentRealtimeEventsBatch(
  ctx: ApiCallContext,
  refreshToken: string,
  propertyId: string,
  eventNames: string[],
): Promise<Map<string, number>> {
  const result = new Map(eventNames.map((n) => [n, 0]));
  if (eventNames.length === 0) return result;

  const data = getAnalyticsDataClient(refreshToken);
  const start = Date.now();
  const requestBody = {
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: { fieldName: 'eventName', inListFilter: { values: eventNames } },
    },
    minuteRanges: [{ name: 'validationWindow', startMinutesAgo: 5, endMinutesAgo: 0 }],
  };
  try {
    const res = await data.properties.runRealtimeReport({ property: `properties/${propertyId}`, requestBody });
    await logApiCall(
      'ga4',
      ctx,
      'POST',
      'runRealtimeReport',
      requestBody,
      { status: res.status ?? 200, responseBody: res.data },
      Date.now() - start,
    );
    for (const row of res.data.rows ?? []) {
      const name = row.dimensionValues?.[0]?.value;
      const count = Number(row.metricValues?.[0]?.value ?? 0);
      if (name && result.has(name)) result.set(name, count);
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error calling runRealtimeReport';
    await logApiCall('ga4', ctx, 'POST', 'runRealtimeReport', requestBody, { errorMessage: message }, Date.now() - start);
    throw err;
  }
}

export async function pollRealtimeForEvents(
  ctx: ApiCallContext,
  refreshToken: string,
  propertyId: string,
  eventNames: string[],
  attempts = 4,
  delayMs = 4000,
): Promise<Map<string, boolean>> {
  const confirmed = new Map(eventNames.map((n) => [n, false]));
  const remaining = () => eventNames.filter((n) => !confirmed.get(n));

  for (let i = 0; i < attempts && remaining().length > 0; i++) {
    const counts = await countRecentRealtimeEventsBatch(ctx, refreshToken, propertyId, remaining());
    for (const [name, count] of counts) {
      if (count > 0) confirmed.set(name, true);
    }
    if (i < attempts - 1 && remaining().length > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return confirmed;
}
