import { callStapeLogged, stapeFetch, type StapeCallContext } from './client';
import { buildCreateContainerPayload, buildDomainConfigPayload, type DomainConfig } from './resources';

// See the header comment in resources.ts — every path/shape here is a
// best-effort guess pending live verification against a real Stape account.
export type StapeContainer = { id: string; name: string; domain: string; status?: string };

export async function listContainers(ctx: StapeCallContext, apiKey: string): Promise<StapeContainer[]> {
  const data = await callStapeLogged(ctx, 'GET', '/api/v1/containers', {}, () =>
    stapeFetch<{ containers: StapeContainer[] }>(apiKey, 'GET', '/api/v1/containers'),
  );
  return data.containers ?? [];
}

export async function createContainer(ctx: StapeCallContext, apiKey: string, name: string, primaryDomain: string): Promise<StapeContainer> {
  const payload = buildCreateContainerPayload(name, primaryDomain);
  return callStapeLogged(ctx, 'POST', '/api/v1/containers', payload, () =>
    stapeFetch<StapeContainer>(apiKey, 'POST', '/api/v1/containers', payload),
  );
}

export async function configureDomain(ctx: StapeCallContext, apiKey: string, containerId: string, config: DomainConfig): Promise<StapeContainer> {
  const payload = buildDomainConfigPayload(config);
  return callStapeLogged(ctx, 'PATCH', `/api/v1/containers/${containerId}/domain`, payload, () =>
    stapeFetch<StapeContainer>(apiKey, 'PATCH', `/api/v1/containers/${containerId}/domain`, payload),
  );
}
