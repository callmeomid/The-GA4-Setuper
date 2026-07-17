// Fires a real event at Google's Measurement Protocol endpoint — the same
// endpoint gtag.js/GTM ultimately calls — so "fire a real test event" means
// exactly that: a genuine hit, not a mock. debug_mode marks it so it also
// shows up in a human's GA4 DebugView if they have it open, even though we
// read the result back through the Realtime/BigQuery APIs, not DebugView
// itself (DebugView has no public read API).
const COLLECT_URL = 'https://www.google-analytics.com/mp/collect';
const DEBUG_COLLECT_URL = 'https://www.google-analytics.com/debug/mp/collect';

export type MpValidationMessage = { fieldPath?: string; description?: string; validationCode?: string };

function buildPayload(eventName: string, clientId: string, validationRunId: string) {
  return {
    client_id: clientId,
    events: [
      {
        name: eventName,
        params: {
          debug_mode: 1,
          validation_run_id: validationRunId,
        },
      },
    ],
  };
}

// Google's validation server checks the payload is well-formed but never
// actually stores it — always call this before sendTestEvent so a malformed
// event name (GA4 event names are limited to 40 chars, [A-Za-z0-9_], can't
// start with a digit) fails fast with a specific reason instead of silently
// vanishing.
export async function validateTestEventPayload(
  measurementId: string,
  apiSecret: string,
  eventName: string,
  clientId: string,
  validationRunId: string,
): Promise<{ ok: boolean; messages: MpValidationMessage[] }> {
  const url = `${DEBUG_COLLECT_URL}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildPayload(eventName, clientId, validationRunId)),
  });
  if (!res.ok) {
    return { ok: false, messages: [{ description: `Validation endpoint returned HTTP ${res.status}` }] };
  }
  const data = (await res.json()) as { validationMessages?: MpValidationMessage[] };
  const messages = data.validationMessages ?? [];
  return { ok: messages.length === 0, messages };
}

export async function sendTestEvent(measurementId: string, apiSecret: string, eventName: string, clientId: string, validationRunId: string): Promise<void> {
  const url = `${COLLECT_URL}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildPayload(eventName, clientId, validationRunId)),
  });
  // /mp/collect always returns 204 with an empty body regardless of whether
  // Google accepted the hit — that's why validateTestEventPayload (against
  // the /debug/ endpoint) is the only source of "was this well-formed."
  if (!res.ok) {
    throw new Error(`Measurement Protocol collect endpoint returned HTTP ${res.status}`);
  }
}
