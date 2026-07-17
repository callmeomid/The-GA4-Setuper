import { callStape, type StapeCallContext } from './client';
import type { CreateContainerBody, CreateDomainBody, StapeContainer, StapeDomain } from './resources';

type Auth = { region: string; apiKey: string };

export async function listContainers(ctx: StapeCallContext, auth: Auth) {
  return callStape<StapeContainer[]>(ctx, auth.region, auth.apiKey, 'GET', '/containers');
}

export async function getContainer(ctx: StapeCallContext, auth: Auth, identifier: string) {
  return callStape<StapeContainer>(ctx, auth.region, auth.apiKey, 'GET', `/containers/${encodeURIComponent(identifier)}`);
}

export async function createContainer(ctx: StapeCallContext, auth: Auth, body: CreateContainerBody) {
  return callStape<StapeContainer>(ctx, auth.region, auth.apiKey, 'POST', '/containers', body);
}

export async function listDomains(ctx: StapeCallContext, auth: Auth, containerIdentifier: string) {
  const data = await callStape<{ items?: StapeDomain[] } | StapeDomain[]>(
    ctx,
    auth.region,
    auth.apiKey,
    'GET',
    `/containers/${encodeURIComponent(containerIdentifier)}/domains`,
  );
  return Array.isArray(data) ? data : (data.items ?? []);
}

export async function createDomain(ctx: StapeCallContext, auth: Auth, containerIdentifier: string, body: CreateDomainBody) {
  return callStape<StapeDomain>(
    ctx,
    auth.region,
    auth.apiKey,
    'POST',
    `/containers/${encodeURIComponent(containerIdentifier)}/domains`,
    body,
  );
}
