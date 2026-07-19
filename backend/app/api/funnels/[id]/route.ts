import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const funnel = await prisma.funnel.findUnique({
    where: { id: params.id },
    include: { steps: { orderBy: { order: 'asc' } } },
  });

  if (!funnel || funnel.ownerId !== (session.user as { id: string }).id) {
    return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
  }

  return NextResponse.json({ funnel });
}

// Deletes only this app's own records (steps, GTM call logs cascade via the
// schema's onDelete: Cascade) — never touches anything already written to
// GTM itself, since this app can't publish and has no delete-tag/-trigger
// calls to begin with. Any draft trigger/tag from a previous push stays in
// the user's GTM workspace until they clean it up there.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const funnel = await prisma.funnel.findUnique({ where: { id: params.id } });
  if (!funnel || funnel.ownerId !== userId) {
    return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
  }

  await prisma.funnel.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
