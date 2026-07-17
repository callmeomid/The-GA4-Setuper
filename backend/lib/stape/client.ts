import { logApiCall, type ApiCallContext } from '@/lib/apiLog';

export class StapeError extends Error {
  plainEnglish: string;
  status?: number;
  constructor(message: string, plainEnglish: string, status?: number) {
    super(message);
    this.plainEnglish = plainEnglish;
    this.status = status;
  }
}

// Field-level validation errors come back as { body: { errors: { field: string[] \} \} } —
// captured from Stape's own MCP server source (createErrorResponse.ts), since
// Stape's API docs page is JS-rendered and wasn't fetchable here. Surfacing
// the real field message (not just a status code) is what makes "graceful
// handling of auth/permission failures" actually mean something for Stape.
type StapeErrorBody = { body?: { errors?: Record<string, string[]> } };

function translateError(status: number, body: unknown): StapeError {
  const fieldErrors = (body as StapeErrorBody)?.body?.errors;
  const detail = fieldErrors
    ? Object.entries(fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join('. ')}`)
        .join(' ')
    : undefined;

  if (status === 401 || status === 403) {
    return new StapeError(
      detail ?? `HTTP ${status}`,
      "Your Stape API key was rejected. Generate a fresh one in Stape (Account settings → API Keys) and reconnect it from Settings.",
      status,
    );
  }
  if (status === 404) {
    return new StapeError(detail ?? 'Not found', "That Stape container or domain couldn't be found — it may have been deleted or you're on the wrong account region.", status);
  }
  if (status === 429) {
    return new StapeError(detail ?? 'Rate limited', 'Stape is rate-limiting these requests. Wait a minute and try again.', status);
  }
  if (status === 400 || status === 422) {
    return new StapeError(detail ?? 'Validation error', detail ? `Stape rejected this: ${detail}` : 'Stape rejected this request — check the values above.', status);
  }
  return new StapeError(detail ?? `HTTP ${status}`, `Stape returned an unexpected error${detail ? `: ${detail}` : '.'}`, status);
}

function baseUrl(region: string): string {
  // Confirmed from stape-mcp-server's wrangler.jsonc — not documented on a
  // page we could fetch directly.
  return region === 'eu' ? 'https://api.app.eu.stape.io/api/v2' : 'https://api.app.stape.io/api/v2';
}

export type StapeCallContext = ApiCallContext;

// Mirrors callGtmLogged / callGa4Logged: every Stape call, success or
// failure, leaves one ApiLog row (system: "stape"). Stape has no SDK, so
// this wraps a plain fetch instead of a generated client.
export async function callStape<T>(
  ctx: StapeCallContext,
  region: string,
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const start = Date.now();
  const url = `${baseUrl(region)}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-AUTH-TOKEN': apiKey },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const translated = new StapeError(
      err instanceof Error ? err.message : 'Network error',
      'Could not reach Stape — check your network connection and try again.',
    );
    await logApiCall('stape', ctx, method, path, body, { errorMessage: translated.message }, Date.now() - start);
    throw translated;
  }

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON error body (e.g. an upstream 502 HTML page) — parsed stays null.
  }

  if (!res.ok) {
    const translated = translateError(res.status, parsed);
    await logApiCall('stape', ctx, method, path, body, { status: res.status, errorMessage: translated.message }, Date.now() - start);
    throw translated;
  }

  const data = ((parsed as { body?: T })?.body ?? parsed) as T;
  await logApiCall('stape', ctx, method, path, body, { status: res.status, responseBody: data }, Date.now() - start);
  return data;
}
