import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request, { params }: { params: { id: string; runId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const body = await request.json().catch(() => ({}));
  const stepResultId: string | undefined = body?.stepResultId;
  const outcome: 'pass' | 'fail' | undefined = body?.outcome;
  if (!stepResultId || (outcome !== 'pass' && outcome !== 'fail')) {
    return NextResponse.json({ error: 'stepResultId and outcome ("pass" | "fail") are required' }, { status: 400 });
  }

  const funnel = await prisma.funnel.findUnique({ where: { id: params.id } });
  if (!funnel || funnel.ownerId !== userId) return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });

  const result = await prisma.validationStepResult.findUnique({ where: { id: stepResultId } });
  if (!result || result.runId !== params.runId) return NextResponse.json({ error: 'Validation step result not found' }, { status: 404 });

  const updated = await prisma.validationStepResult.update({
    where: { id: stepResultId },
    data: { outcome, detail: 'Manually confirmed in GA4 DebugView.', checkedAt: new Date() },
  });

  return NextResponse.json({ result: updated });
}
