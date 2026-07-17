import { callGa4Logged, getAnalyticsAdminClient, getAnalyticsDataClient, getBigQueryClient, type Ga4CallContext } from './client';

export type PropertyOption = {
  accountId: string;
  accountName: string;
  propertyId: string;
  propertyDisplayName: string;
};

// One call gets the whole account/property tree — GA4's Admin API is kinder
// here than GTM's, which needs a separate containers.list per account.
export async function listAccountSummaries(ctx: Ga4CallContext, refreshToken: string): Promise<PropertyOption[]> {
  const analyticsadmin = getAnalyticsAdminClient(refreshToken);
  const data = await callGa4Logged(ctx, 'GET', 'accountSummaries.list', {}, () => analyticsadmin.accountSummaries.list({ pageSize: 200 }));
  const summaries = data.accountSummaries ?? [];
  const options: PropertyOption[] = [];
  for (const summary of summaries) {
    for (const prop of summary.propertySummaries ?? []) {
      if (!prop.property || !summary.account) continue;
      options.push({
        accountId: summary.account,
        accountName: summary.displayName ?? summary.account,
        propertyId: prop.property,
        propertyDisplayName: prop.displayName ?? prop.property,
      });
    }
  }
  return options;
}

export async function listConversionEvents(ctx: Ga4CallContext, refreshToken: string, propertyPath: string) {
  const analyticsadmin = getAnalyticsAdminClient(refreshToken);
  const data = await callGa4Logged(ctx, 'GET', 'conversionEvents.list', { parent: propertyPath }, () =>
    analyticsadmin.properties.conversionEvents.list({ parent: propertyPath, pageSize: 200 }),
  );
  return data.conversionEvents ?? [];
}

export async function createConversionEvent(ctx: Ga4CallContext, refreshToken: string, propertyPath: string, eventName: string) {
  const analyticsadmin = getAnalyticsAdminClient(refreshToken);
  return callGa4Logged(ctx, 'POST', 'conversionEvents.create', { parent: propertyPath, eventName }, () =>
    analyticsadmin.properties.conversionEvents.create({ parent: propertyPath, requestBody: { eventName } }),
  );
}

export async function listDataStreams(ctx: Ga4CallContext, refreshToken: string, propertyPath: string) {
  const analyticsadmin = getAnalyticsAdminClient(refreshToken);
  const data = await callGa4Logged(ctx, 'GET', 'dataStreams.list', { parent: propertyPath }, () =>
    analyticsadmin.properties.dataStreams.list({ parent: propertyPath, pageSize: 200 }),
  );
  // Only web streams carry a measurementId — app streams (iOS/Android) don't
  // send events via the web Measurement Protocol path this app uses.
  return (data.dataStreams ?? []).filter((s) => s.webStreamData?.measurementId);
}

// Reuses an existing "Funnel Setuper validation" secret if one was already
// created on this stream (idempotent, same spirit as GTM's getOrCreateWorkspace),
// otherwise creates one. The secret value is only returned by the API at
// creation/list time — never stored beyond the lifetime of the request that
// needed it, since it's a live credential.
const VALIDATION_SECRET_NAME = 'Funnel Setuper validation';

export async function getOrCreateMeasurementProtocolSecret(ctx: Ga4CallContext, refreshToken: string, streamPath: string) {
  const analyticsadmin = getAnalyticsAdminClient(refreshToken);
  const listData = await callGa4Logged(ctx, 'GET', 'measurementProtocolSecrets.list', { parent: streamPath }, () =>
    analyticsadmin.properties.dataStreams.measurementProtocolSecrets.list({ parent: streamPath }),
  );
  const existing = (listData.measurementProtocolSecrets ?? []).find((s) => s.displayName === VALIDATION_SECRET_NAME);
  if (existing?.secretValue) return existing.secretValue;

  const created = await callGa4Logged(
    ctx,
    'POST',
    'measurementProtocolSecrets.create',
    { parent: streamPath, displayName: VALIDATION_SECRET_NAME },
    () =>
      analyticsadmin.properties.dataStreams.measurementProtocolSecrets.create({
        parent: streamPath,
        requestBody: { displayName: VALIDATION_SECRET_NAME },
      }),
  );
  if (!created.secretValue) throw new Error('GA4 did not return a secret value for the newly created Measurement Protocol secret.');
  return created.secretValue;
}

// Coarse confirmation path: "was this event name seen at all in the last few
// minutes" — no per-event correlation id, since eventName is the only
// dimension realtime reporting can filter on without custom-dimension
// registration. See ValidationSource question this feature was built against:
// intentionally the roughest of the three validation paths.
export async function runRealtimeEventCount(ctx: Ga4CallContext, refreshToken: string, propertyPath: string, eventName: string) {
  const analyticsdata = getAnalyticsDataClient(refreshToken);
  const data = await callGa4Logged(ctx, 'POST', 'runRealtimeReport', { property: propertyPath, eventName }, () =>
    analyticsdata.properties.runRealtimeReport({
      property: propertyPath,
      requestBody: {
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: eventName } },
        },
        minuteRanges: [{ name: 'last30min', startMinutesAgo: 29, endMinutesAgo: 0 }],
      },
    }),
  );
  const count = (data.rows ?? []).reduce((sum, row) => sum + Number(row.metricValues?.[0]?.value ?? 0), 0);
  return count;
}

// GA4's BigQuery export always includes the full event_params array for
// every event regardless of custom-dimension registration in the GA4 UI, so
// this is the one validation path that can match the exact test event (via
// validationId) rather than just "an event with this name happened".
export function bigQueryDefaultDataset(propertyPath: string) {
  const numericId = propertyPath.replace('properties/', '');
  return `analytics_${numericId}`;
}

export async function bigQueryFindValidationEvent(
  ctx: Ga4CallContext,
  refreshToken: string,
  projectId: string,
  datasetId: string,
  eventName: string,
  validationId: string,
) {
  const bigquery = getBigQueryClient(refreshToken);
  const query = `
    SELECT COUNT(*) AS match_count
    FROM \`${projectId}.${datasetId}.events_intraday_*\`, UNNEST(event_params) AS param
    WHERE event_name = @eventName
      AND param.key = 'validation_id'
      AND param.value.string_value = @validationId
  `;
  const data = await callGa4Logged(
    ctx,
    'POST',
    'bigquery.jobs.query',
    { projectId, datasetId, eventName, validationId },
    () =>
      bigquery.jobs.query({
        projectId,
        requestBody: {
          query,
          useLegacySql: false,
          parameterMode: 'NAMED',
          queryParameters: [
            { name: 'eventName', parameterType: { type: 'STRING' }, parameterValue: { value: eventName } },
            { name: 'validationId', parameterType: { type: 'STRING' }, parameterValue: { value: validationId } },
          ],
        },
      }),
  );
  const count = Number(data.rows?.[0]?.f?.[0]?.v ?? 0);
  return count > 0;
}
