import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { createContainer, createDomain, listContainers, listDomains } from '@/lib/stape/api';
import { buildStapePlan, extractHostnames } from '@/lib/stape/plan';
import type { StapeDomainRecord } from '@/lib/stape/resources';
import { loadFunnelForStape, loadStapeConnection, StapeSetupError } from '@/lib/stape/setup';
import { prisma } from '@/lib/prisma';

type DomainResult = { rootDomain: string; domainName: string; outcome: 'created' | 'reused' | 'error'; records?: StapeDomainRecord[]; error?: string };

export async function POST(_request: Request, { params }: { params: { id: string } }) {
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

    let containerIdentifier = plan.container.identifier;
    if (plan.container.outcome === 'new') {
      const created = await createContainer(ctx, auth, { name: plan.container.name, code: plan.container.code });
      containerIdentifier = created.identifier;
    }
    if (!containerIdentifier) {
      return NextResponse.json({ error: 'Could not resolve a Stape container identifier.' }, { status: 502 });
    }

    await prisma.funnel.update({ where: { id: funnel.id }, data: { stapeContainerIdentifier: containerIdentifier } });

    const domainResults: DomainResult[] = [];
    for (const domainPlan of plan.domains) {
      if (domainPlan.outcome === 'reuse') {
        domainResults.push({ rootDomain: domainPlan.rootDomain, domainName: domainPlan.proposedName, outcome: 'reused' });
        continue;
      }
      try {
        const created = await createDomain(ctx, auth, containerIdentifier, {
          name: domainPlan.proposedName,
          connectionType: 'direct',
        });
        domainResults.push({ rootDomain: domainPlan.rootDomain, domainName: domainPlan.proposedName, outcome: 'created', records: created.records });
      } catch (err) {
        const plainEnglish = (err as { plainEnglish?: string }).plainEnglish ?? (err instanceof Error ? err.message : 'Unknown error');
        domainResults.push({ rootDomain: domainPlan.rootDomain, domainName: domainPlan.proposedName, outcome: 'error', error: plainEnglish });
      }
    }

    const anyError = domainResults.some((d) => d.outcome === 'error');
    await prisma.funnelStep.updateMany({
      where: { funnelId: funnel.id },
      data: { stapeStatus: anyError ? 'error' : 'configured' },
    });

    return NextResponse.json({
      container: { identifier: containerIdentifier, name: plan.container.name, outcome: plan.container.outcome },
      domains: domainResults,
      cookieDomainValue: plan.cookieDomainValue,
      crossDomainWarning: plan.crossDomainWarning,
    });
  } catch (err) {
    if (err instanceof StapeSetupError) return NextResponse.json({ error: err.message }, { status: err.status });
    const plainEnglish = (err as { plainEnglish?: string }).plainEnglish;
    const message = plainEnglish ?? (err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
