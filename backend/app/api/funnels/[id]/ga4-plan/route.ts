import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { buildGa4Plan } from '@/lib/ga4/plan';
import { fetchExistingConversionEvents, loadFunnelForGa4, loadGa4Connection, Ga4SetupError } from '@/lib/ga4/setup';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
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

    return NextResponse.json({ plan });
  } catch (err) {
    if (err instanceof Ga4SetupError) return NextResponse.json({ error: err.message }, { status: err.status });
    const plainEnglish = (err as { plainEnglish?: string }).plainEnglish;
    const message = plainEnglish ?? (err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
