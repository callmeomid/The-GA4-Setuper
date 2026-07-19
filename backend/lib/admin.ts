import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Returns the signed-in admin's userId, or null if not signed in / not an admin.
// Used by both the /admin/vouchers page (redirect on null) and its API routes
// (403 on null) — isAdmin is a plain DB flag, set manually (see prisma/seed.ts),
// there's no self-service way to become an admin.
export async function requireAdminUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user) return null;
  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.isAdmin ? userId : null;
}
