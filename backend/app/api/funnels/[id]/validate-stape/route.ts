import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkContainerHealth } from '@/lib/stape/client';
import { prisma } from '@/lib/prisma';

// Only meaningful for server-side funnels — client-side setups have no
// container to check, so this route only ever runs from the server-mode
// branch of the validation page.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const funnel = await prisma.funnel.findUnique({ where: { id: params.id } });
  if (!funnel || funnel.ownerId !== userId) return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
  if (!funnel.stapeContainerUrl) return NextResponse.json({ error: 'No server container set up for this funnel yet.' }, { status: 400 });

  const status = await checkContainerHealth(funnel.stapeContainerUrl);
  await prisma.funnel.update({ where: { id: funnel.id }, data: { stapeContainerStatus: status } });

  return NextResponse.json({ status });
}
