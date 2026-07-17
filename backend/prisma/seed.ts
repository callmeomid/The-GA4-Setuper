import { PrismaClient } from '@prisma/client';
import { getOrCreateWorkspaceForUser } from '../lib/workspace';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'demo@funnel-setuper.local' },
    update: {},
    create: {
      email: 'demo@funnel-setuper.local',
      name: 'Demo User',
      apiKey: 'demo-api-key-local-dev-only',
    },
  });
  // Bypasses the NextAuth `createUser` event (this user is upserted directly,
  // not signed in through Google), so provision the workspace here instead.
  const workspace = await getOrCreateWorkspaceForUser(user.id);
  console.log('Seeded user:', user.id, user.email, 'apiKey:', user.apiKey, 'workspace:', workspace.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
