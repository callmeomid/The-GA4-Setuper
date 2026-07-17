import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { listAccounts, listContainers } from '@/lib/gtm/api';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const connection = await prisma.gtmConnection.findUnique({ where: { userId } });
  if (!connection) return NextResponse.json({ error: 'Not connected to Google Tag Manager' }, { status: 400 });

  const accountId = new URL(request.url).searchParams.get('accountId');
  const ctx = { userId };

  try {
    if (accountId) {
      const containers = await listContainers(ctx, connection.refreshToken, accountId);
      return NextResponse.json({ containers });
    }
    const accounts = await listAccounts(ctx, connection.refreshToken);
    return NextResponse.json({ accounts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const plainEnglish = (err as { plainEnglish?: string }).plainEnglish ?? message;
    return NextResponse.json({ error: plainEnglish }, { status: 502 });
  }
}
