import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GA4 DebugView isn't readable through any public API — Google only exposes
// it as a live panel in the GA4 UI — so this records the user's own
// confirmation after they've triggered the step and watched it appear there,
// rather than pretending to verify it automatically.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const body = await request.json().catch(() => ({}));
  const stepId: string | undefined = body?.stepId;
  const confirmed: boolean = body?.confirmed !== false;
  if (!stepId) return NextResponse.json({ error: 'stepId is required' }, { status: 400 });

  const step = await prisma.funnelStep.findUnique({ where: { id: stepId }, include: { funnel: true } });
  if (!step || step.funnel.ownerId !== userId || step.funnel.id !== params.id) {
    return NextResponse.json({ error: 'Step not found' }, { status: 404 });
  }

  const updated = await prisma.funnelStep.update({
    where: { id: stepId },
    data: { ga4Status: confirmed ? 'validated' : 'created' },
  });

  return NextResponse.json({ stepId: updated.id, ga4Status: updated.ga4Status });
}
