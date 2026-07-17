import { prisma } from '@/lib/prisma';
import {
  ensureBuiltInVariables,
  getLiveGa4ConfigTag,
  getOrCreateWorkspace,
  listTags,
  listTriggers,
} from './api';
import type { GtmSnapshot } from './plan';

export class SetupError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function loadFunnelForGtm(userId: string, funnelId: string) {
  const funnel = await prisma.funnel.findUnique({
    where: { id: funnelId },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  if (!funnel || funnel.ownerId !== userId) throw new SetupError('Funnel not found', 404);
  if (funnel.status !== 'approved') throw new SetupError('Approve this funnel before setting up GTM.', 400);
  return funnel;
}

export async function loadGtmConnection(userId: string) {
  const connection = await prisma.gtmConnection.findUnique({ where: { userId } });
  if (!connection) throw new SetupError('Connect Google Tag Manager in Settings first.', 400);
  if (!connection.gtmAccountId || !connection.gtmContainerId) {
    throw new SetupError('Select a GTM container in Settings first.', 400);
  }
  return connection as typeof connection & { gtmAccountId: string; gtmContainerId: string };
}

// Getting or creating the dedicated workspace and enabling built-in variables
// are both draft-only, reversible operations with no effect on the live
// container — so unlike triggers.create/tags.create (gated behind explicit
// "Push to GTM"), we do these eagerly while building the preview, since an
// accurate conflict-check requires actually looking at the workspace's
// current contents.
export async function prepareWorkspaceAndSnapshot(
  userId: string,
  funnelId: string,
  funnelName: string,
  connection: { refreshToken: string; gtmAccountId: string; gtmContainerId: string },
) {
  const ctx = { userId, funnelId };
  const workspaceName = `Funnel Setuper: ${funnelName}`;
  const workspace = await getOrCreateWorkspace(
    ctx,
    connection.refreshToken,
    connection.gtmAccountId,
    connection.gtmContainerId,
    workspaceName,
  );
  const workspacePath = workspace.path!;

  await ensureBuiltInVariables(ctx, connection.refreshToken, workspacePath);

  const [triggers, tags, liveGa4Tag] = await Promise.all([
    listTriggers(ctx, connection.refreshToken, workspacePath),
    listTags(ctx, connection.refreshToken, workspacePath),
    getLiveGa4ConfigTag(ctx, connection.refreshToken, connection.gtmAccountId, connection.gtmContainerId),
  ]);

  const snapshot: GtmSnapshot = {
    existingTriggers: triggers.map((t) => ({ id: t.triggerId!, name: t.name! })),
    existingTags: tags.map((t) => ({ id: t.tagId!, name: t.name! })),
    liveGa4ConfigTag: liveGa4Tag
      ? {
          name: liveGa4Tag.name!,
          measurementId: liveGa4Tag.parameter?.find((p) => p.key === 'measurementId')?.value ?? '',
        }
      : null,
  };

  return { workspace, workspacePath, snapshot };
}
