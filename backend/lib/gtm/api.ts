import type { tagmanager_v2 } from 'googleapis';
import { callGtmLogged, getTagmanagerClient, type GtmCallContext } from './client';

// Built-in variables we rely on for scoping triggers and enriching GA4 event
// parameters. Enabling an already-enabled one is a no-op per the API, so this
// is safe to call every time rather than tracking what we've enabled before.
export const REQUIRED_BUILT_IN_VARIABLES = ['PAGE_PATH', 'CLICK_ELEMENT', 'CLICK_TEXT', 'CLICK_CLASSES', 'FORM_ID'] as const;

export async function listAccounts(ctx: GtmCallContext, refreshToken: string) {
  const tagmanager = getTagmanagerClient(refreshToken);
  const data = await callGtmLogged(ctx, 'GET', 'accounts.list', {}, () => tagmanager.accounts.list());
  return data.account ?? [];
}

export async function listContainers(ctx: GtmCallContext, refreshToken: string, accountId: string) {
  const tagmanager = getTagmanagerClient(refreshToken);
  const parent = `accounts/${accountId}`;
  const data = await callGtmLogged(ctx, 'GET', 'containers.list', { parent }, () => tagmanager.accounts.containers.list({ parent }));
  return data.container ?? [];
}

export async function getOrCreateWorkspace(
  ctx: GtmCallContext,
  refreshToken: string,
  accountId: string,
  containerId: string,
  name: string,
) {
  const tagmanager = getTagmanagerClient(refreshToken);
  const parent = `accounts/${accountId}/containers/${containerId}`;

  const listData = await callGtmLogged(ctx, 'GET', 'workspaces.list', { parent }, () =>
    tagmanager.accounts.containers.workspaces.list({ parent }),
  );
  const existing = (listData.workspace ?? []).find((w) => w.name === name);
  if (existing) return existing;

  return callGtmLogged(ctx, 'POST', 'workspaces.create', { parent, name }, () =>
    tagmanager.accounts.containers.workspaces.create({ parent, requestBody: { name, description: 'Created by Funnel Setuper' } }),
  );
}

export async function ensureBuiltInVariables(ctx: GtmCallContext, refreshToken: string, workspacePath: string) {
  const tagmanager = getTagmanagerClient(refreshToken);
  const listData = await callGtmLogged(ctx, 'GET', 'built_in_variables.list', { parent: workspacePath }, () =>
    tagmanager.accounts.containers.workspaces.built_in_variables.list({ parent: workspacePath }),
  );
  const enabled = new Set((listData.builtInVariable ?? []).map((v) => v.type));
  const missing = REQUIRED_BUILT_IN_VARIABLES.filter((t) => !enabled.has(t));
  if (missing.length === 0) return;

  await callGtmLogged(ctx, 'POST', 'built_in_variables.create', { parent: workspacePath, type: missing }, () =>
    tagmanager.accounts.containers.workspaces.built_in_variables.create({ parent: workspacePath, type: missing }),
  );
}

export async function listTriggers(ctx: GtmCallContext, refreshToken: string, workspacePath: string) {
  const tagmanager = getTagmanagerClient(refreshToken);
  const data = await callGtmLogged(ctx, 'GET', 'triggers.list', { parent: workspacePath }, () =>
    tagmanager.accounts.containers.workspaces.triggers.list({ parent: workspacePath }),
  );
  return data.trigger ?? [];
}

export async function createTrigger(
  ctx: GtmCallContext,
  refreshToken: string,
  workspacePath: string,
  trigger: tagmanager_v2.Schema$Trigger,
) {
  const tagmanager = getTagmanagerClient(refreshToken);
  return callGtmLogged(ctx, 'POST', 'triggers.create', { parent: workspacePath, trigger }, () =>
    tagmanager.accounts.containers.workspaces.triggers.create({ parent: workspacePath, requestBody: trigger }),
  );
}

export async function listTags(ctx: GtmCallContext, refreshToken: string, workspacePath: string) {
  const tagmanager = getTagmanagerClient(refreshToken);
  const data = await callGtmLogged(ctx, 'GET', 'tags.list', { parent: workspacePath }, () =>
    tagmanager.accounts.containers.workspaces.tags.list({ parent: workspacePath }),
  );
  return data.tag ?? [];
}

export async function createTag(ctx: GtmCallContext, refreshToken: string, workspacePath: string, tag: tagmanager_v2.Schema$Tag) {
  const tagmanager = getTagmanagerClient(refreshToken);
  return callGtmLogged(ctx, 'POST', 'tags.create', { parent: workspacePath, tag }, () =>
    tagmanager.accounts.containers.workspaces.tags.create({ parent: workspacePath, requestBody: tag }),
  );
}

// The rollback path for a half-completed push: since every mutation this app
// makes lives in one dedicated per-funnel workspace and nothing else in the
// container is ever touched, deleting that one workspace undoes the entire
// run in a single call — no need to reverse individual trigger/tag creates.
export async function deleteWorkspace(ctx: GtmCallContext, refreshToken: string, workspacePath: string) {
  const tagmanager = getTagmanagerClient(refreshToken);
  await callGtmLogged(ctx, 'DELETE', 'workspaces.delete', { path: workspacePath }, async () => {
    await tagmanager.accounts.containers.workspaces.delete({ path: workspacePath });
    return { data: null, status: 204 };
  });
}

// Checked against the *live published version*, not our draft workspace —
// this is how we find an existing GA4 Configuration tag to reuse instead of
// creating a duplicate that would double-fire pageviews. A container that's
// never been published has no live version; that's not an error, just "none
// found yet."
export async function getLiveGa4ConfigTag(ctx: GtmCallContext, refreshToken: string, accountId: string, containerId: string) {
  const tagmanager = getTagmanagerClient(refreshToken);
  const parent = `accounts/${accountId}/containers/${containerId}`;
  try {
    const data = await callGtmLogged(ctx, 'GET', 'versions.live', { parent }, () =>
      tagmanager.accounts.containers.versions.live({ parent }),
    );
    return (data.tag ?? []).find((t) => t.type === 'gaawc') ?? null;
  } catch (err) {
    if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 404) return null;
    throw err;
  }
}
