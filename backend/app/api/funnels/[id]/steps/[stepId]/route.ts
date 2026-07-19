import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TriggerTypeSchema } from '@/lib/schema';
import { z } from 'zod';

const StepUpdateSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  urlPattern: z.string().min(1).max(2000).optional(),
  triggerType: TriggerTypeSchema.optional(),
  selector: z.string().max(2000).nullable().optional(),
});

async function loadOwnedStep(userId: string, funnelId: string, stepId: string) {
  const step = await prisma.funnelStep.findUnique({ where: { id: stepId }, include: { funnel: true } });
  if (!step || step.funnelId !== funnelId || step.funnel.ownerId !== userId) return null;
  return step;
}

export async function PATCH(request: Request, { params }: { params: { id: string; stepId: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const step = await loadOwnedStep(userId, params.id, params.stepId);
  if (!step) return NextResponse.json({ error: 'Step not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = StepUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid step data', issues: parsed.error.issues }, { status: 400 });

  const data = parsed.data;
  if (data.triggerType && data.triggerType !== 'click') data.selector = null;

  const updated = await prisma.funnelStep.update({ where: { id: params.stepId }, data });
  return NextResponse.json({ step: updated });
}

// Renumbers the remaining steps' `order` to stay contiguous — cosmetic only
// (FlowDiagram just sorts by it), but keeps "STEP 01/02/03" labels sane after
// a step in the middle is removed rather than leaving a gap.
export async function DELETE(_request: Request, { params }: { params: { id: string; stepId: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const step = await loadOwnedStep(userId, params.id, params.stepId);
  if (!step) return NextResponse.json({ error: 'Step not found' }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.funnelStep.delete({ where: { id: params.stepId } });
    const remaining = await tx.funnelStep.findMany({ where: { funnelId: params.id }, orderBy: { order: 'asc' } });
    await Promise.all(remaining.map((s, i) => tx.funnelStep.update({ where: { id: s.id }, data: { order: i + 1 } })));
  });

  return NextResponse.json({ ok: true });
}
