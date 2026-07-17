import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { listConversionEvents } from '@/lib/ga4/api';
import { buildGa4Plan } from '@/lib/ga4/plan';
import { Ga4SetupError, loadFunnelForGa4, loadGa4Connection } from '@/lib/ga4/setup';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  try {
    const funnel = await loadFunnelForGa4(userId, params.id);
    const connection = await loadGa4Connection(userId);

    const existing = await listConversionEvents({ userId, funnelId: funnel.id }, connection.refreshToken, connection.ga4PropertyId);
    const plan = buildGa4Plan(
      funnel.steps.map((s) => ({ id: s.id, order: s.order, label: s.label, ga4EventName: s.ga4EventName })),
      existing.map((e) => ({ eventName: e.eventName ?? '' })),
    );

    return NextResponse.json({ plan, propertyDisplayName: connection.ga4PropertyDisplayName });
  } catch (err) {
    if (err instanceof Ga4SetupError) return NextResponse.json({ error: err.message }, { status: err.status });
    const plainEnglish = (err as { plainEnglish?: string }).plainEnglish;
    const message = plainEnglish ?? (err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
