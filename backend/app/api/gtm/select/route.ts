import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const body = await request.json();
  const { accountId, containerId, containerPublicId } = body ?? {};
  if (!accountId || !containerId) {
    return NextResponse.json({ error: 'accountId and containerId are required' }, { status: 400 });
  }

  const connection = await prisma.gtmConnection.findUnique({ where: { userId } });
  if (!connection) return NextResponse.json({ error: 'Not connected to Google Tag Manager' }, { status: 400 });

  await prisma.gtmConnection.update({
    where: { userId },
    data: { gtmAccountId: accountId, gtmContainerId: containerId, gtmContainerPublicId: containerPublicId ?? null },
  });

  return NextResponse.json({ ok: true });
}
