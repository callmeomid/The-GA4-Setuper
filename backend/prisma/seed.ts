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

  // Grants /admin/vouchers access. No-op until this account has signed in at
  // least once via Google OAuth (the row has to exist first) — safe to re-run.
  if (process.env.ADMIN_EMAIL) {
    const { count } = await prisma.user.updateMany({
      where: { email: process.env.ADMIN_EMAIL },
      data: { isAdmin: true },
    });
    console.log(count ? `Granted isAdmin to ${process.env.ADMIN_EMAIL}` : `${process.env.ADMIN_EMAIL} hasn't signed in yet — skipped`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
