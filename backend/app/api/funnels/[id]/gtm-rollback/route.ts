import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { deleteWorkspace } from '@/lib/gtm/api';
import { logError } from '@/lib/log';
import { prisma } from '@/lib/prisma';

// The rollback for a partially-wired GTM push (see PushAttempt.outcome ===
// 'partial'): delete the funnel's dedicated GTM workspace — the one place
// every trigger/tag this app ever created lives — and reset our own records
// of it back to pending. One call undoes the whole run; there is nothing
// else to reverse, because this app never writes anywhere else in the
// container and never publishes (see lib/gtm/oauth.ts's scope comment).
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const funnel = await prisma.funnel.findUnique({ where: { id: params.id }, include: { steps: true } });
  if (!funnel || funnel.ownerId !== userId) {
    return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
  }
  if (!funnel.gtmWorkspaceId) {
    return NextResponse.json({ error: 'Nothing to roll back — no GTM workspace has been created for this funnel yet.' }, { status: 400 });
  }

  const connection = await prisma.gtmConnection.findUnique({ where: { userId } });
  if (!connection?.gtmAccountId || !connection.gtmContainerId) {
    return NextResponse.json({ error: 'Connect Google Tag Manager in Settings first.' }, { status: 400 });
  }

  const runId = crypto.randomUUID();
  const workspacePath = `accounts/${connection.gtmAccountId}/containers/${connection.gtmContainerId}/workspaces/${funnel.gtmWorkspaceId}`;

  try {
    await deleteWorkspace({ userId, funnelId: funnel.id, runId }, connection.refreshToken, workspacePath);
  } catch (err) {
    // Rollback failing is the containment path itself breaking — worth
    // paging on regardless of what the underlying GTM error translates to.
    logError(`GTM workspace rollback failed for funnel "${funnel.name}"`, err, {
      tags: { push_outcome: 'rollback_failed' },
      funnelId: funnel.id,
      runId,
      workspacePath,
    });
    const plainEnglish = (err as { plainEnglish?: string }).plainEnglish;
    const message = plainEnglish ?? (err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: `Rollback failed: ${message}` }, { status: 502 });
  }

  await prisma.$transaction([
    prisma.funnel.update({
      where: { id: funnel.id },
      data: { gtmWorkspaceId: null, ga4ConfigTagName: null },
    }),
    prisma.funnelStep.updateMany({
      where: { funnelId: funnel.id },
      data: { gtmTriggerId: null, gtmTagId: null, gtmStatus: 'pending', ga4Status: 'pending' },
    }),
  ]);

  return NextResponse.json({ ok: true, runId });
}
