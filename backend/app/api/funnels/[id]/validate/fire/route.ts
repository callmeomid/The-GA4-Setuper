import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getOrCreateMeasurementProtocolSecret } from '@/lib/ga4/api';
import { debugValidateEvent, sendTestEvent } from '@/lib/ga4/mp';
import { eventNameForStep, loadFunnelForValidation, loadGa4ConnectionForValidation, newValidationId, ValidationError, type ValidationMethod } from '@/lib/validate/run';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const body = await request.json().catch(() => ({}));
  const method: ValidationMethod | undefined = body?.method;
  const streamName: string | undefined = body?.streamName;
  const measurementId: string | undefined = body?.measurementId;
  const bigQueryProjectId: string | undefined = body?.bigQueryProjectId;
  const bigQueryDatasetId: string | undefined = body?.bigQueryDatasetId;

  if (!method || !streamName || !measurementId) {
    return NextResponse.json({ error: 'method, streamName, and measurementId are required' }, { status: 400 });
  }
  if (method === 'bigquery' && !bigQueryProjectId) {
    return NextResponse.json({ error: 'bigQueryProjectId is required for the BigQuery validation method' }, { status: 400 });
  }

  try {
    const funnel = await loadFunnelForValidation(userId, params.id);
    const connection = await loadGa4ConnectionForValidation(userId);
    const ctx = { userId, funnelId: funnel.id };

    await prisma.funnel.update({
      where: { id: funnel.id },
      data: { validationMethod: method, bigQueryProjectId: bigQueryProjectId ?? null, bigQueryDatasetId: bigQueryDatasetId ?? null },
    });

    const apiSecret = await getOrCreateMeasurementProtocolSecret(ctx, connection.refreshToken, streamName);

    const run = await prisma.validationRun.create({ data: { funnelId: funnel.id, method } });

    for (const step of funnel.steps) {
      const eventName = eventNameForStep(step);
      const validationId = newValidationId();

      let mpMessages: unknown[] = [];
      let outcome: 'pending' | 'pending_manual' | 'error' = method === 'debugview' ? 'pending_manual' : 'pending';
      let detail: string | null = null;

      try {
        mpMessages = await debugValidateEvent(ctx, measurementId, apiSecret, eventName, validationId);
        await sendTestEvent(ctx, measurementId, apiSecret, eventName, validationId);
      } catch (err) {
        outcome = 'error';
        const plainEnglish = (err as { plainEnglish?: string }).plainEnglish;
        detail = plainEnglish ?? (err instanceof Error ? err.message : 'Failed to send test event.');
      }

      await prisma.validationStepResult.create({
        data: {
          runId: run.id,
          stepId: step.id,
          label: step.label,
          eventName,
          validationId,
          outcome,
          detail,
          mpValidationMessages: JSON.stringify(mpMessages),
        },
      });
    }

    const full = await prisma.validationRun.findUnique({ where: { id: run.id }, include: { results: { orderBy: { createdAt: 'asc' } } } });
    return NextResponse.json({ run: full });
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: err.status });
    const plainEnglish = (err as { plainEnglish?: string }).plainEnglish;
    const message = plainEnglish ?? (err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
