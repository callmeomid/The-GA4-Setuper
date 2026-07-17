import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { runValidation, ValidationError } from '@/lib/validate/run';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const funnel = await prisma.funnel.findUnique({ where: { id: params.id } });
  if (!funnel || funnel.ownerId !== userId) return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });

  const latest = await prisma.validationRun.findFirst({ where: { funnelId: params.id }, orderBy: { createdAt: 'desc' } });
  if (!latest) return NextResponse.json({ run: null });

  return NextResponse.json({
    run: { id: latest.id, source: latest.source, overallPass: latest.overallPass, createdAt: latest.createdAt, steps: JSON.parse(latest.resultsJson) },
  });
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  try {
    const result = await runValidation(userId, params.id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: err.status });
    const plainEnglish = (err as { plainEnglish?: string }).plainEnglish;
    const message = plainEnglish ?? (err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
