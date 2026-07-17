import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { createConversionEvent, listConversionEvents } from '@/lib/ga4/api';
import { buildGa4Plan } from '@/lib/ga4/plan';
import { Ga4SetupError, loadFunnelForGa4, loadGa4Connection } from '@/lib/ga4/setup';
import { prisma } from '@/lib/prisma';

type StepResult = { stepId: string; label: string; eventName: string; outcome: 'created' | 'reused' | 'error'; error?: string };

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const body = await request.json().catch(() => ({}));
  const eventNameOverrides: Record<string, string> = body?.eventNameOverrides ?? {};

  try {
    const funnel = await loadFunnelForGa4(userId, params.id);
    const connection = await loadGa4Connection(userId);

    for (const [stepId, eventName] of Object.entries(eventNameOverrides)) {
      if (!eventName) continue;
      await prisma.funnelStep.update({ where: { id: stepId }, data: { ga4EventName: eventName } });
      const step = funnel.steps.find((s) => s.id === stepId);
      if (step) step.ga4EventName = eventName;
    }

    const ctx = { userId, funnelId: funnel.id };
    const existing = await listConversionEvents(ctx, connection.refreshToken, connection.ga4PropertyId);
    const plan = buildGa4Plan(
      funnel.steps.map((s) => ({ id: s.id, order: s.order, label: s.label, ga4EventName: s.ga4EventName })),
      existing.map((e) => ({ eventName: e.eventName ?? '' })),
    );

    const results: StepResult[] = [];
    for (const stepPlan of plan) {
      const result: StepResult = { stepId: stepPlan.stepId, label: stepPlan.label, eventName: stepPlan.eventName, outcome: 'reused' };
      try {
        if (stepPlan.outcome === 'new') {
          await createConversionEvent(ctx, connection.refreshToken, connection.ga4PropertyId, stepPlan.eventName);
          result.outcome = 'created';
        }
        await prisma.funnelStep.update({
          where: { id: stepPlan.stepId },
          data: { ga4EventName: stepPlan.eventName, ga4Status: result.outcome },
        });
      } catch (err) {
        const plainEnglish = (err as { plainEnglish?: string }).plainEnglish;
        result.outcome = 'error';
        result.error = plainEnglish ?? (err instanceof Error ? err.message : 'Unknown error');
      }
      results.push(result);
    }

    const propertyUrl = `https://analytics.google.com/analytics/web/#/${connection.ga4PropertyId}/admin/conversion-events`;
    return NextResponse.json({ results, propertyUrl });
  } catch (err) {
    if (err instanceof Ga4SetupError) return NextResponse.json({ error: err.message }, { status: err.status });
    const plainEnglish = (err as { plainEnglish?: string }).plainEnglish;
    const message = plainEnglish ?? (err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
