import { callGa4Logged, type Ga4CallContext } from './client';

// The Measurement Protocol is how validation fires a real event without a
// browser: it's the same wire protocol gtag.js/GTM ultimately send over, so a
// successful MP send is a faithful stand-in for "the funnel step fired".
const MP_DEBUG_ENDPOINT = 'https://www.google-analytics.com/debug/mp/collect';
const MP_COLLECT_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

export type MpValidationMessage = { fieldPath?: string; description?: string; validationCode?: string };

function testClientId() {
  return `${Math.floor(Math.random() * 2_000_000_000)}.${Math.floor(Date.now() / 1000)}`;
}

function buildPayload(eventName: string, validationId: string) {
  return {
    client_id: testClientId(),
    events: [
      {
        name: eventName,
        params: {
          debug_mode: 1,
          validation_id: validationId,
        },
      },
    ],
  };
}

async function postMp(ctx: Ga4CallContext, endpoint: string, url: URL, payload: unknown) {
  return callGa4Logged(ctx, 'POST', endpoint, payload, async () => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`Measurement Protocol responded ${res.status}: ${text || res.statusText}`) as Error & {
        response?: { status: number };
      };
      err.response = { status: res.status };
      throw err;
    }
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    return { data, status: res.status };
  });
}

// Schema-only check — validates the event shape without ingesting it.
// Returns whatever validationMessages GA4 reports (empty array = clean).
export async function debugValidateEvent(
  ctx: Ga4CallContext,
  measurementId: string,
  apiSecret: string,
  eventName: string,
  validationId: string,
): Promise<MpValidationMessage[]> {
  const url = new URL(MP_DEBUG_ENDPOINT);
  url.searchParams.set('measurement_id', measurementId);
  url.searchParams.set('api_secret', apiSecret);
  const payload = buildPayload(eventName, validationId);
  const data = await postMp(ctx, 'debug/mp/collect', url, payload);
  return (data as { validationMessages?: MpValidationMessage[] }).validationMessages ?? [];
}

// Actually sends the event (debug_mode: true keeps it out of standard
// reporting funnels but it still lands in DebugView / BigQuery export).
export async function sendTestEvent(
  ctx: Ga4CallContext,
  measurementId: string,
  apiSecret: string,
  eventName: string,
  validationId: string,
): Promise<void> {
  const url = new URL(MP_COLLECT_ENDPOINT);
  url.searchParams.set('measurement_id', measurementId);
  url.searchParams.set('api_secret', apiSecret);
  const payload = buildPayload(eventName, validationId);
  await postMp(ctx, 'mp/collect', url, payload);
}
