import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { listContainers, listDomains } from '@/lib/stape/api';
import { buildStapePlan, extractHostnames } from '@/lib/stape/plan';
import { loadFunnelForStape, loadStapeConnection, StapeSetupError } from '@/lib/stape/setup';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  try {
    const funnel = await loadFunnelForStape(userId, params.id);
    const connection = await loadStapeConnection(userId);
    const ctx = { userId, funnelId: funnel.id };
    const auth = { region: connection.region, apiKey: connection.apiKey };

    const containers = await listContainers(ctx, auth);
    const hostnames = extractHostnames(funnel.steps.map((s) => s.urlPattern));

    let existingDomainNames = new Set<string>();
    const matchingContainer = containers.find((c) => c.identifier === funnel.stapeContainerIdentifier);
    if (matchingContainer) {
      const domains = await listDomains(ctx, auth, matchingContainer.identifier);
      existingDomainNames = new Set(domains.map((d) => d.name));
    }

    const plan = buildStapePlan(
      funnel.name,
      funnel.id,
      hostnames,
      Boolean(funnel.stapeSpansSubdomains),
      containers.map((c) => ({ code: c.code, name: c.name, identifier: c.identifier })),
      existingDomainNames,
    );

    return NextResponse.json({ plan, spansSubdomainsAnswered: funnel.stapeSpansSubdomains !== null });
  } catch (err) {
    if (err instanceof StapeSetupError) return NextResponse.json({ error: err.message, needsSubdomainAnswer: err.status === 400 && /spans subdomains/.test(err.message) }, { status: err.status });
    const plainEnglish = (err as { plainEnglish?: string }).plainEnglish;
    const message = plainEnglish ?? (err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
