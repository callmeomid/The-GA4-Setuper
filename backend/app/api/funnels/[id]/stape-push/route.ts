import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { configureDomain, createContainer, listContainers } from '@/lib/stape/api';
import { buildStapePlan } from '@/lib/stape/plan';
import type { DomainTopology } from '@/lib/stape/resources';
import { allDomainsFromSteps, loadFunnelForStape, loadStapeConnection, primaryDomainFromSteps, StapeSetupError } from '@/lib/stape/setup';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const body = await request.json().catch(() => ({}));
  const topology: DomainTopology | undefined = body?.topology;
  const rootDomain: string | null = body?.rootDomain || null;
  const allowedDomainsInput: string[] | undefined = body?.allowedDomains;

  if (!topology) return NextResponse.json({ error: 'topology is required' }, { status: 400 });

  try {
    const funnel = await loadFunnelForStape(userId, params.id);
    const connection = await loadStapeConnection(userId);
    const primaryDomain = primaryDomainFromSteps(funnel.steps);
    if (!primaryDomain) {
      return NextResponse.json({ error: 'Could not determine a domain from this funnel’s steps.' }, { status: 400 });
    }
    const allowedDomains = allowedDomainsInput?.length ? allowedDomainsInput : allDomainsFromSteps(funnel.steps);

    await prisma.funnel.update({
      where: { id: funnel.id },
      data: { domainTopology: topology, rootDomain, allowedDomainsJson: JSON.stringify(allowedDomains) },
    });

    const ctx = { userId, funnelId: funnel.id };
    const existing = await listContainers(ctx, connection.apiKey);
    const plan = buildStapePlan(funnel.name, primaryDomain, existing, topology, rootDomain, allowedDomains);

    const container = plan.container.outcome === 'reuse'
      ? existing.find((c) => c.name === plan.container.name)!
      : await createContainer(ctx, connection.apiKey, plan.container.name, primaryDomain);

    const configured = await configureDomain(ctx, connection.apiKey, container.id, plan.domain);

    await prisma.funnel.update({
      where: { id: funnel.id },
      data: { stapeContainerId: container.id, stapeContainerDomain: configured.domain ?? container.domain },
    });
    await prisma.funnelStep.updateMany({ where: { funnelId: funnel.id }, data: { stapeStatus: plan.container.outcome === 'new' ? 'created' : 'reused' } });

    return NextResponse.json({ container: { ...container, ...configured }, domain: plan.domain, warnings: plan.warnings });
  } catch (err) {
    if (err instanceof StapeSetupError) return NextResponse.json({ error: err.message }, { status: err.status });
    const plainEnglish = (err as { plainEnglish?: string }).plainEnglish;
    const message = plainEnglish ?? (err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
