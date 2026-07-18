import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const setupMode = body?.setupMode;
  if (setupMode !== 'client' && setupMode !== 'server') {
    return NextResponse.json({ error: 'setupMode must be "client" or "server"' }, { status: 400 });
  }

  const funnel = await prisma.funnel.findUnique({ where: { id: params.id } });
  if (!funnel || funnel.ownerId !== (session.user as { id: string }).id) {
    return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
  }
  if (funnel.status !== 'approved') {
    return NextResponse.json({ error: 'Approve this funnel before choosing a setup path.' }, { status: 400 });
  }

  // Switching client -> server later (the upgrade path) is just choosing
  // "server" again here — gtmWorkspaceId, ga4ConfigTagName, and every step's
  // gtmTriggerId/gtmTagId are untouched, so the next gtm-plan/gtm-push run
  // detects and edits what's already there instead of starting over.
  const updated = await prisma.funnel.update({ where: { id: params.id }, data: { setupMode } });

  return NextResponse.json({ id: updated.id, setupMode: updated.setupMode });
}
