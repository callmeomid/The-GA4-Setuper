import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { createWrappedDek } from '@/lib/crypto/workspaceKeys';

// One workspace per user today (see prisma/schema.prisma for why this is a
// join table, not a column on User). New users get theirs created via the
// NextAuth `createUser` event (lib/auth.ts); this stays idempotent and
// self-healing for any account that predates that hook.
export async function getOrCreateWorkspaceForUser(userId: string) {
  const membership = await prisma.workspaceMember.findFirst({ where: { userId }, include: { workspace: true } });
  if (membership) return membership.workspace;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  // Generated up front (not left to Prisma's default) so the workspace id
  // exists before the row does — createWrappedDek binds it into the DEK's
  // AAD, which needs the id to encrypt with.
  const workspaceId = crypto.randomUUID();
  const { wrappedDek, dekKeyVersion } = createWrappedDek(workspaceId);

  return prisma.workspace.create({
    data: {
      id: workspaceId,
      name: user?.name ? `${user.name}'s workspace` : 'My workspace',
      wrappedDek,
      dekKeyVersion,
      members: { create: { userId, role: 'OWNER' } },
    },
  });
}

export async function requireWorkspaceIdForUser(userId: string): Promise<string> {
  return (await getOrCreateWorkspaceForUser(userId)).id;
}
