import { PrismaClient } from '@prisma/client';

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
  console.log('Seeded user:', user.id, user.email, 'apiKey:', user.apiKey);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
