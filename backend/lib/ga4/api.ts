import { callGa4, getAnalyticsAdminClient, getAnalyticsDataClient } from './client';

export type Ga4Property = {
  propertyId: string; // resource name, e.g. "properties/123456"
  displayName: string;
  accountName: string;
};

export async function listProperties(refreshToken: string): Promise<Ga4Property[]> {
  const admin = getAnalyticsAdminClient(refreshToken);
  const data = await callGa4(() => admin.accountSummaries.list({ pageSize: 200 }));

  const properties: Ga4Property[] = [];
  for (const account of data.accountSummaries ?? []) {
    for (const property of account.propertySummaries ?? []) {
      if (!property.property) continue;
      properties.push({
        propertyId: property.property,
        displayName: property.displayName ?? property.property,
        accountName: account.displayName ?? 'Account',
      });
    }
  }
  return properties;
}

export type Ga4WebStream = {
  streamId: string;
  displayName: string;
  measurementId: string;
  defaultUri: string | null;
};

export async function listWebDataStreams(refreshToken: string, propertyId: string): Promise<Ga4WebStream[]> {
  const admin = getAnalyticsAdminClient(refreshToken);
  const data = await callGa4(() => admin.properties.dataStreams.list({ parent: propertyId, pageSize: 200 }));

  return (data.dataStreams ?? [])
    .filter((stream) => stream.type === 'WEB_DATA_STREAM' && stream.webStreamData?.measurementId)
    .map((stream) => ({
      streamId: stream.name ?? '',
      displayName: stream.displayName ?? 'Web stream',
      measurementId: stream.webStreamData!.measurementId!,
      defaultUri: stream.webStreamData?.defaultUri ?? null,
    }));
}

// Checks GA4's realtime report (last ~30 minutes, GA4's own realtime window)
// for each event name and returns which ones have shown up at all. This is a
// presence check, not a count — one event in the window is enough to confirm
// wiring, which is all the validate step needs to know.
export async function checkRealtimeEvents(refreshToken: string, propertyId: string, eventNames: string[]): Promise<Set<string>> {
  if (eventNames.length === 0) return new Set();

  const data = getAnalyticsDataClient(refreshToken);
  const response = await callGa4(() =>
    data.properties.runRealtimeReport({
      property: propertyId,
      requestBody: {
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        limit: '100',
      },
    }),
  );

  const seen = new Set<string>();
  for (const row of response.rows ?? []) {
    const name = row.dimensionValues?.[0]?.value;
    if (name && eventNames.includes(name)) seen.add(name);
  }
  return seen;
}
