import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const funnel = await prisma.funnel.findUnique({ where: { id: params.id } });
  if (!funnel || funnel.ownerId !== userId) return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const subdomain: string = (body?.subdomain ?? '').trim();
  if (!subdomain) return NextResponse.json({ error: 'subdomain is required' }, { status: 400 });

  await prisma.funnel.update({ where: { id: funnel.id }, data: { stapeSubdomain: subdomain } });
  return NextResponse.json({ ok: true });
}
