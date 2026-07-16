import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const funnel = await prisma.funnel.findUnique({ where: { id: params.id } });
  if (!funnel || funnel.ownerId !== (session.user as { id: string }).id) {
    return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
  }

  const updated = await prisma.funnel.update({
    where: { id: params.id },
    data: { status: 'approved' },
  });

  return NextResponse.json({ id: updated.id, status: updated.status });
}
