import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { decryptWorkspaceSecret } from '@/lib/crypto/tokenVault';
import { listAccounts, listContainers } from '@/lib/gtm/api';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceIdForUser } from '@/lib/workspace';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const workspaceId = await requireWorkspaceIdForUser(userId);

  const connection = await prisma.gtmConnection.findUnique({ where: { workspaceId } });
  if (!connection) return NextResponse.json({ error: 'Not connected to Google Tag Manager' }, { status: 400 });

  const accountId = new URL(request.url).searchParams.get('accountId');
  const ctx = { userId };
  const refreshToken = await decryptWorkspaceSecret(workspaceId, 'gtmRefreshToken', connection.refreshTokenEnc);

  try {
    if (accountId) {
      const containers = await listContainers(ctx, refreshToken, accountId);
      return NextResponse.json({ containers });
    }
    const accounts = await listAccounts(ctx, refreshToken);
    return NextResponse.json({ accounts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const plainEnglish = (err as { plainEnglish?: string }).plainEnglish ?? message;
    return NextResponse.json({ error: plainEnglish }, { status: 502 });
  }
}
