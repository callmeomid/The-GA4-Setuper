import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { createConversionEvent } from '@/lib/ga4/api';
import { buildGa4Plan } from '@/lib/ga4/plan';
import { fetchExistingConversionEvents, loadFunnelForGa4, loadGa4Connection, Ga4SetupError } from '@/lib/ga4/setup';
import { prisma } from '@/lib/prisma';

type StepResult = { stepId: string; label: string; eventName: string; outcome: 'created' | 'reused' | 'skipped' | 'error'; error?: string };

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  try {
    const funnel = await loadFunnelForGa4(userId, params.id);
    const connection = await loadGa4Connection(userId);
    const ctx = { userId, funnelId: funnel.id };

    const existingEvents = await fetchExistingConversionEvents(ctx, connection.refreshToken, connection.ga4PropertyId);
    const plan = buildGa4Plan(
      connection.ga4PropertyId,
      connection.ga4PropertyDisplayName ?? connection.ga4PropertyId,
      funnel.steps.map((s) => ({
        id: s.id,
        order: s.order,
        label: s.label,
        ga4EventName: s.ga4EventName,
        ga4ConversionEventResourceName: s.ga4ConversionEventResourceName,
      })),
      existingEvents,
    );

    const results: StepResult[] = [];

    for (const stepPlan of plan.steps) {
      const step = funnel.steps.find((s) => s.id === stepPlan.stepId)!;
      const result: StepResult = { stepId: step.id, label: step.label, eventName: stepPlan.eventName, outcome: 'skipped' };

      try {
        if (stepPlan.outcome === 'reuse') {
          result.outcome = 'reused';
          await prisma.funnelStep.update({
            where: { id: step.id },
            data: { ga4EventName: stepPlan.eventName, ga4Status: 'reused' },
          });
        } else {
          const created = await createConversionEvent(ctx, connection.refreshToken, connection.ga4PropertyId, stepPlan.eventName);
          result.outcome = 'created';
          await prisma.funnelStep.update({
            where: { id: step.id },
            data: { ga4EventName: stepPlan.eventName, ga4ConversionEventResourceName: created.name ?? null, ga4Status: 'conversion' },
          });
        }
      } catch (err) {
        const plainEnglish = (err as { plainEnglish?: string }).plainEnglish;
        result.error = plainEnglish ?? (err instanceof Error ? err.message : 'Unknown error');
        result.outcome = 'error';
        await prisma.funnelStep.update({ where: { id: step.id }, data: { ga4Status: 'error' } }).catch(() => {});
      }

      results.push(result);
    }

    await prisma.funnel.update({ where: { id: funnel.id }, data: { ga4PropertyId: connection.ga4PropertyId } });

    const propertyUrl = `https://analytics.google.com/analytics/web/#/p${connection.ga4PropertyId}/admin/conversion-events`;

    return NextResponse.json({ results, propertyUrl });
  } catch (err) {
    if (err instanceof Ga4SetupError) return NextResponse.json({ error: err.message }, { status: err.status });
    const plainEnglish = (err as { plainEnglish?: string }).plainEnglish;
    const message = plainEnglish ?? (err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
