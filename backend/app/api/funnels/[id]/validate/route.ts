import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { checkRealtimeEvents } from '@/lib/ga4/api';
import { deriveEventName } from '@/lib/gtm/event-name';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const funnel = await prisma.funnel.findUnique({
    where: { id: params.id },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  if (!funnel || funnel.ownerId !== userId) return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });

  if (!funnel.steps.some((s) => s.gtmStatus === 'created')) {
    return NextResponse.json({ error: 'Push this funnel to GTM before validating it.', code: 'not_pushed' }, { status: 400 });
  }

  const connection = await prisma.ga4Connection.findUnique({ where: { userId } });
  if (!connection?.ga4PropertyId) {
    return NextResponse.json(
      { error: 'Connect Google Analytics and select a property in Settings before validating.', code: 'not_connected' },
      { status: 400 },
    );
  }

  const stepsWithEventNames = funnel.steps.map((s) => ({ step: s, eventName: s.ga4EventName ?? deriveEventName(s.label) }));

  let seen: Set<string>;
  try {
    seen = await checkRealtimeEvents(connection.refreshToken, connection.ga4PropertyId, stepsWithEventNames.map((s) => s.eventName));
  } catch (err) {
    const plainEnglish = (err as { plainEnglish?: string }).plainEnglish;
    const message = plainEnglish ?? (err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const results = await Promise.all(
    stepsWithEventNames.map(async ({ step, eventName }) => {
      let validatedAt = step.validatedAt;
      if (!validatedAt && seen.has(eventName)) {
        validatedAt = new Date();
        await prisma.funnelStep.update({ where: { id: step.id }, data: { validatedAt } });
      }
      return { stepId: step.id, order: step.order, label: step.label, eventName, validated: Boolean(validatedAt), validatedAt };
    }),
  );

  return NextResponse.json({
    steps: results,
    allValidated: results.every((r) => r.validated),
    ga4PropertyName: connection.ga4PropertyName,
  });
}
