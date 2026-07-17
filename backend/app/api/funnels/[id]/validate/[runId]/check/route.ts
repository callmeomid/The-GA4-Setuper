import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { checkPendingResult, loadFunnelForValidation, loadGa4ConnectionForValidation, ValidationError } from '@/lib/validate/run';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request, { params }: { params: { id: string; runId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  try {
    const funnel = await loadFunnelForValidation(userId, params.id);
    const connection = await loadGa4ConnectionForValidation(userId);
    const ctx = { userId, funnelId: funnel.id };

    const run = await prisma.validationRun.findUnique({ where: { id: params.runId }, include: { results: true } });
    if (!run || run.funnelId !== funnel.id) return NextResponse.json({ error: 'Validation run not found' }, { status: 404 });

    if (run.method === 'bigquery' || run.method === 'realtime') {
      const bigQuery = funnel.bigQueryProjectId ? { projectId: funnel.bigQueryProjectId, datasetId: funnel.bigQueryDatasetId } : null;
      for (const result of run.results) {
        if (result.outcome !== 'pending') continue;
        const checked = await checkPendingResult(ctx, connection.refreshToken, run.method, connection.ga4PropertyId, bigQuery, result);
        await prisma.validationStepResult.update({
          where: { id: result.id },
          data: { outcome: checked.outcome, detail: checked.detail, checkedAt: new Date() },
        });
      }
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
