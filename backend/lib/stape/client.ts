import { callLogged, type LogCallContext } from '@/lib/integration-log';

export class StapeError extends Error {
  plainEnglish: string;
  status?: number;
  constructor(message: string, plainEnglish: string, status?: number) {
    super(message);
    this.plainEnglish = plainEnglish;
    this.status = status;
  }
}

function translateError(err: unknown): StapeError {
  const anyErr = err as { status?: number; message?: string };
  const status = anyErr?.status;
  const rawMessage = anyErr?.message ?? 'Unknown Stape API error';

  if (status === 401) {
    return new StapeError(rawMessage, 'Your Stape API key was rejected. Check it in Settings and try again.', 401);
  }
  if (status === 403) {
    return new StapeError(rawMessage, "Your Stape account doesn't have permission for this — check your plan/role in the Stape dashboard.", 403);
  }
  if (status === 429) {
    return new StapeError(rawMessage, 'Stape is rate-limiting these requests. Wait a minute and try again.', 429);
  }
  if (status === 404) {
    return new StapeError(rawMessage, "That Stape container couldn't be found — it may have been deleted.", 404);
  }
  if (!status && /fetch failed|ENOTFOUND|ECONNREFUSED/i.test(rawMessage)) {
    return new StapeError(rawMessage, "Couldn't reach the Stape API. Check your network connection, or that STAPE_API_BASE_URL is correct if you've overridden it.");
  }
  return new StapeError(rawMessage, `Stape returned an unexpected error: ${rawMessage}`, status);
}

export type StapeCallContext = LogCallContext;

export async function callStapeLogged<T>(
  context: StapeCallContext,
  method: string,
  endpoint: string,
  requestBody: unknown,
  fn: () => Promise<{ data: T; status?: number }>,
): Promise<T> {
  try {
    return await callLogged('stape', context, method, endpoint, requestBody, fn);
  } catch (err) {
    throw translateError(err);
  }
}

// api.stape.io is this app's best guess at Stape's Public API host — Stape
// generation has never run against a live account (see lib/stape/api.ts for
// the full caveat). Overridable so this can be pointed at a confirmed URL
// without a code change once verified.
export function stapeApiBase() {
  return process.env.STAPE_API_BASE_URL ?? 'https://api.stape.io';
}

export async function stapeFetch<T>(apiKey: string, method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown): Promise<{ data: T; status: number }> {
  const res = await fetch(`${stapeApiBase()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : ({} as T);
  if (!res.ok) {
    const err = new Error(`Stape API responded ${res.status}: ${text || res.statusText}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return { data: data as T, status: res.status };
}
