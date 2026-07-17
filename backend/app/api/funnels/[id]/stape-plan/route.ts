import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { listContainers } from '@/lib/stape/api';
import { buildStapePlan } from '@/lib/stape/plan';
import type { DomainTopology } from '@/lib/stape/resources';
import { allDomainsFromSteps, loadFunnelForStape, loadStapeConnection, primaryDomainFromSteps, StapeSetupError } from '@/lib/stape/setup';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const url = new URL(request.url);
  const topology = url.searchParams.get('topology') as DomainTopology | null;
  const rootDomain = url.searchParams.get('rootDomain');
  const allowedDomainsParam = url.searchParams.get('allowedDomains');

  try {
    const funnel = await loadFunnelForStape(userId, params.id);
    const primaryDomain = primaryDomainFromSteps(funnel.steps);
    const detectedDomains = allDomainsFromSteps(funnel.steps);

    if (!primaryDomain) {
      return NextResponse.json({ error: 'Could not determine a domain from this funnel’s steps — every step’s URL pattern failed to parse.' }, { status: 400 });
    }

    if (!topology) {
      return NextResponse.json({ needsTopology: true, primaryDomain, detectedDomains });
    }

    const connection = await loadStapeConnection(userId);
    const allowedDomains = allowedDomainsParam ? allowedDomainsParam.split(',').map((d) => d.trim()).filter(Boolean) : detectedDomains;
    const existing = await listContainers({ userId, funnelId: funnel.id }, connection.apiKey);
    const plan = buildStapePlan(funnel.name, primaryDomain, existing, topology, rootDomain, allowedDomains);

    return NextResponse.json({ plan, primaryDomain, detectedDomains });
  } catch (err) {
    if (err instanceof StapeSetupError) return NextResponse.json({ error: err.message }, { status: err.status });
    const plainEnglish = (err as { plainEnglish?: string }).plainEnglish;
    const message = plainEnglish ?? (err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
