import { callGa4Logged, getAnalyticsAdminClient, type Ga4CallContext } from './client';

// accountSummaries.list already nests every property under its account in
// one call — GA4 has no separate "list containers under this account" step
// the way GTM does, so the property picker only needs one request.
export async function listAccountSummaries(ctx: Ga4CallContext, refreshToken: string) {
  const admin = getAnalyticsAdminClient(refreshToken);
  const data = await callGa4Logged(ctx, 'GET', 'accountSummaries.list', {}, () =>
    admin.accountSummaries.list({ pageSize: 200 }),
  );
  return data.accountSummaries ?? [];
}

export async function listConversionEvents(ctx: Ga4CallContext, refreshToken: string, propertyId: string) {
  const admin = getAnalyticsAdminClient(refreshToken);
  const parent = `properties/${propertyId}`;
  const data = await callGa4Logged(ctx, 'GET', 'conversionEvents.list', { parent }, () =>
    admin.properties.conversionEvents.list({ parent, pageSize: 200 }),
  );
  return data.conversionEvents ?? [];
}

export async function createConversionEvent(ctx: Ga4CallContext, refreshToken: string, propertyId: string, eventName: string) {
  const admin = getAnalyticsAdminClient(refreshToken);
  const parent = `properties/${propertyId}`;
  return callGa4Logged(ctx, 'POST', 'conversionEvents.create', { parent, eventName }, () =>
    admin.properties.conversionEvents.create({ parent, requestBody: { eventName } }),
  );
}

export async function listDataStreams(ctx: Ga4CallContext, refreshToken: string, propertyId: string) {
  const admin = getAnalyticsAdminClient(refreshToken);
  const parent = `properties/${propertyId}`;
  const data = await callGa4Logged(ctx, 'GET', 'dataStreams.list', { parent }, () =>
    admin.properties.dataStreams.list({ parent, pageSize: 100 }),
  );
  return data.dataStreams ?? [];
}

export async function listMeasurementProtocolSecrets(ctx: Ga4CallContext, refreshToken: string, dataStreamName: string) {
  const admin = getAnalyticsAdminClient(refreshToken);
  const data = await callGa4Logged(ctx, 'GET', 'measurementProtocolSecrets.list', { parent: dataStreamName }, () =>
    admin.properties.dataStreams.measurementProtocolSecrets.list({ parent: dataStreamName }),
  );
  return data.measurementProtocolSecrets ?? [];
}

// Only ever called from the validation flow (lib/validate), never from
// ga4-plan/ga4-push — a Measurement Protocol secret exists purely to let us
// send a synthetic test event, it isn't part of the conversion-event setup
// the user reviewed and approved.
export async function createMeasurementProtocolSecret(ctx: Ga4CallContext, refreshToken: string, dataStreamName: string, displayName: string) {
  const admin = getAnalyticsAdminClient(refreshToken);
  return callGa4Logged(ctx, 'POST', 'measurementProtocolSecrets.create', { parent: dataStreamName, displayName }, () =>
    admin.properties.dataStreams.measurementProtocolSecrets.create({ parent: dataStreamName, requestBody: { displayName } }),
  );
}
