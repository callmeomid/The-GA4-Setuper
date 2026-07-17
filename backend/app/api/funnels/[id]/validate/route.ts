import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { listDataStreams } from '@/lib/ga4/api';
import { debugViewUrl, loadFunnelForValidation, loadGa4ConnectionForValidation, ValidationError } from '@/lib/validate/run';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  try {
    const funnel = await loadFunnelForValidation(userId, params.id);
    const connection = await loadGa4ConnectionForValidation(userId);

    const streams = await listDataStreams({ userId, funnelId: funnel.id }, connection.refreshToken, connection.ga4PropertyId);
    const runs = await prisma.validationRun.findMany({
      where: { funnelId: funnel.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { results: { orderBy: { createdAt: 'asc' } } },
    });

    return NextResponse.json({
      streams: streams.map((s) => ({ name: s.name, measurementId: s.webStreamData?.measurementId, displayName: s.displayName })),
      runs,
      debugViewUrl: debugViewUrl(connection.ga4PropertyId),
      funnel: {
        validationMethod: funnel.validationMethod,
        bigQueryProjectId: funnel.bigQueryProjectId,
        bigQueryDatasetId: funnel.bigQueryDatasetId,
      },
    });
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: err.status });
    const plainEnglish = (err as { plainEnglish?: string }).plainEnglish;
    const message = plainEnglish ?? (err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
