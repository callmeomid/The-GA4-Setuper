// Talks to Stape.io's container-management API so a server container can be
// created without leaving this app. NOTE: unlike lib/gtm (built against
// Google's published, versioned client library), this targets the shape of
// Stape's REST API from their public docs as of when this was written — this
// environment has no network access to Stape to confirm it byte-for-byte.
// Verify the endpoint paths and payload shape against https://stape.io/docs
// before pointing this at a real account; a config-level base URL override
// (STAPE_API_BASE_URL) is provided so a wrong path is a one-line fix, not a
// redeploy.

const STAPE_API_BASE_URL = process.env.STAPE_API_BASE_URL ?? 'https://api.stape.io';

export class StapeError extends Error {
  plainEnglish: string;
  status?: number;
  constructor(message: string, plainEnglish: string, status?: number) {
    super(message);
    this.plainEnglish = plainEnglish;
    this.status = status;
  }
}

function requireApiKey(): string {
  const key = process.env.STAPE_API_KEY;
  if (!key) {
    throw new StapeError(
      'STAPE_API_KEY not set',
      'Server-side setup needs a Stape.io API key. Add STAPE_API_KEY to the environment and try again.',
    );
  }
  return key;
}

async function stapeFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${STAPE_API_BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${requireApiKey()}`, ...(init?.headers ?? {}) },
    });
  } catch (err) {
    throw new StapeError(
      err instanceof Error ? err.message : 'Network error',
      "Couldn't reach Stape.io — check your network connection and try again.",
    );
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const plainEnglish =
      res.status === 401 || res.status === 403
        ? 'Stape.io rejected the API key — check STAPE_API_KEY and try again.'
        : res.status === 429
          ? 'Stape.io is rate-limiting these requests. Wait a minute and try again.'
          : `Stape.io returned an unexpected error (${res.status}).`;
    throw new StapeError(`Stape API ${res.status}: ${JSON.stringify(body)}`, plainEnglish, res.status);
  }
  return body as T;
}

export type StapeContainer = {
  id: string;
  domain: string;
  status: string;
};

export async function createContainer(subdomain: string, siteName: string): Promise<StapeContainer> {
  return stapeFetch<StapeContainer>('/api/v2/containers', {
    method: 'POST',
    body: JSON.stringify({ domain: subdomain, name: siteName }),
  });
}

export async function getContainer(containerId: string): Promise<StapeContainer> {
  return stapeFetch<StapeContainer>(`/api/v2/containers/${containerId}`);
}

// Stape containers conventionally serve a lightweight health path at the
// container's own domain — used for the validation step's automated check.
// Flagged for the same reason as above: confirm the exact path in Stape's
// docs for the container type actually provisioned.
export async function checkContainerHealth(containerUrl: string): Promise<'healthy' | 'unreachable'> {
  try {
    const res = await fetch(`${containerUrl}/healthy`, { method: 'GET' });
    return res.ok ? 'healthy' : 'unreachable';
  } catch {
    return 'unreachable';
  }
}
