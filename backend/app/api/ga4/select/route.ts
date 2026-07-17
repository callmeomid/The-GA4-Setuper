import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const body = await request.json();
  const { accountId, propertyId, propertyDisplayName } = body ?? {};
  if (!accountId || !propertyId) {
    return NextResponse.json({ error: 'accountId and propertyId are required' }, { status: 400 });
  }

  const connection = await prisma.ga4Connection.findUnique({ where: { userId } });
  if (!connection) return NextResponse.json({ error: 'Not connected to Google Analytics' }, { status: 400 });

  await prisma.ga4Connection.update({
    where: { userId },
    data: { ga4AccountId: accountId, ga4PropertyId: propertyId, ga4PropertyDisplayName: propertyDisplayName ?? null },
  });

  return NextResponse.json({ ok: true });
}
