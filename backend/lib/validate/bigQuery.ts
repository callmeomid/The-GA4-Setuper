import { google } from 'googleapis';
import { logApiCall, type ApiCallContext } from '@/lib/apiLog';
import { ga4ClientFromRefreshToken } from '@/lib/ga4/oauth';

export type BigQueryExport = { projectId: string; datasetId: string };

// v1alpha is the only Admin API surface with bigQueryLinks — v1beta doesn't
// expose it. Used read-only here (list), which is within what v1alpha
// promises even for fields still in flux.
export async function findBigQueryExport(ctx: ApiCallContext, refreshToken: string, propertyId: string): Promise<BigQueryExport | null> {
  const admin = google.analyticsadmin({ version: 'v1alpha', auth: ga4ClientFromRefreshToken(refreshToken) });
  const parent = `properties/${propertyId}`;
  const start = Date.now();
  try {
    const res = await admin.properties.bigQueryLinks.list({ parent });
    await logApiCall('ga4', ctx, 'GET', 'bigQueryLinks.list', { parent }, { status: res.status ?? 200, responseBody: res.data }, Date.now() - start);
    const link = res.data.bigqueryLinks?.[0];
    if (!link?.project) return null;
    const projectId = link.project.replace(/^projects\//, '');
    // GA4's BigQuery export always names the dataset "analytics_<propertyId>"
    // in the linked project — this is Google's fixed convention, not
    // something the link resource itself returns.
    return { projectId, datasetId: `analytics_${propertyId}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error calling bigQueryLinks.list';
    await logApiCall('ga4', ctx, 'GET', 'bigQueryLinks.list', { parent }, { errorMessage: message }, Date.now() - start);
    return null;
  }
}

// Matches on our validation_run_id event param, not just event_name — the
// one exact-match check in this whole validation layer, because BigQuery's
// export nests every event param (unlike Realtime, which needs a registered
// custom dimension). events_intraday_* is a wildcard over today's
// still-streaming tables; it can lag by minutes depending on the property's
// export freshness setting, so "not found yet" isn't necessarily "failed."
export async function findEventInBigQuery(
  ctx: ApiCallContext,
  refreshToken: string,
  exportInfo: BigQueryExport,
  eventName: string,
  validationRunId: string,
): Promise<boolean> {
  const bigquery = google.bigquery({ version: 'v2', auth: ga4ClientFromRefreshToken(refreshToken) });
  const query = `
    SELECT COUNT(1) AS c
    FROM \`${exportInfo.projectId}.${exportInfo.datasetId}.events_intraday_*\`
    WHERE event_name = @eventName
      AND EXISTS (
        SELECT 1 FROM UNNEST(event_params) p
        WHERE p.key = 'validation_run_id' AND p.value.string_value = @validationRunId
      )
  `;
  const start = Date.now();
  const requestBody = {
    query,
    useLegacySql: false,
    parameterMode: 'NAMED' as const,
    queryParameters: [
      { name: 'eventName', parameterType: { type: 'STRING' }, parameterValue: { value: eventName } },
      { name: 'validationRunId', parameterType: { type: 'STRING' }, parameterValue: { value: validationRunId } },
    ],
  };
  try {
    const res = await bigquery.jobs.query({ projectId: exportInfo.projectId, requestBody });
    await logApiCall('ga4', ctx, 'POST', 'bigquery.jobs.query', requestBody, { status: res.status ?? 200, responseBody: res.data }, Date.now() - start);
    const count = Number(res.data.rows?.[0]?.f?.[0]?.v ?? 0);
    return count > 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error querying BigQuery';
    await logApiCall('ga4', ctx, 'POST', 'bigquery.jobs.query', requestBody, { errorMessage: message }, Date.now() - start);
    return false;
  }
}
