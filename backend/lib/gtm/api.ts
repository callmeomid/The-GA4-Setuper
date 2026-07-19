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

  // Paginated, not just a single page: missing an existing workspace here
  // means falling through to create a duplicate, which fails outright once
  // the container's workspace cap is hit (see translateError in ./client).
  let existing: tagmanager_v2.Schema$Workspace | undefined;
  let pageToken: string | undefined;
  do {
    const listData = await callGtmLogged(ctx, 'GET', 'workspaces.list', { parent, pageToken }, () =>
      tagmanager.accounts.containers.workspaces.list({ parent, pageToken }),
    );
    existing = (listData.workspace ?? []).find((w) => w.name === name);
    pageToken = listData.nextPageToken ?? undefined;
  } while (!existing && pageToken);
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

// Conflict detection (buildFunnelPlan) walks this list to decide whether a
// trigger name is free — a missed page here means a false "new" verdict and
// a duplicate trigger created on push, so every page has to be fetched.
export async function listTriggers(ctx: GtmCallContext, refreshToken: string, workspacePath: string) {
  const tagmanager = getTagmanagerClient(refreshToken);
  const triggers: tagmanager_v2.Schema$Trigger[] = [];
  let pageToken: string | undefined;
  do {
    const data = await callGtmLogged(ctx, 'GET', 'triggers.list', { parent: workspacePath, pageToken }, () =>
      tagmanager.accounts.containers.workspaces.triggers.list({ parent: workspacePath, pageToken }),
    );
    triggers.push(...(data.trigger ?? []));
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);
  return triggers;
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
  const tags: tagmanager_v2.Schema$Tag[] = [];
  let pageToken: string | undefined;
  do {
    const data = await callGtmLogged(ctx, 'GET', 'tags.list', { parent: workspacePath, pageToken }, () =>
      tagmanager.accounts.containers.workspaces.tags.list({ parent: workspacePath, pageToken }),
    );
    tags.push(...(data.tag ?? []));
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);
  return tags;
}

export async function createTag(ctx: GtmCallContext, refreshToken: string, workspacePath: string, tag: tagmanager_v2.Schema$Tag) {
  const tagmanager = getTagmanagerClient(refreshToken);
  return callGtmLogged(ctx, 'POST', 'tags.create', { parent: workspacePath, tag }, () =>
    tagmanager.accounts.containers.workspaces.tags.create({ parent: workspacePath, requestBody: tag }),
  );
}

// Used for the client → server upgrade path: edits a tag this app already
// created (identified by id) in place instead of creating a duplicate.
export async function updateTag(
  ctx: GtmCallContext,
  refreshToken: string,
  workspacePath: string,
  tagId: string,
  tag: tagmanager_v2.Schema$Tag,
) {
  const tagmanager = getTagmanagerClient(refreshToken);
  const path = `${workspacePath}/tags/${tagId}`;
  return callGtmLogged(ctx, 'PUT', 'tags.update', { path, tag }, () =>
    tagmanager.accounts.containers.workspaces.tags.update({ path, requestBody: tag }),
  );
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
