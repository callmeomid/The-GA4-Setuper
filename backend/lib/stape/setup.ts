import { prisma } from '@/lib/prisma';

export class StapeSetupError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function loadFunnelForStape(userId: string, funnelId: string) {
  const funnel = await prisma.funnel.findUnique({
    where: { id: funnelId },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  if (!funnel || funnel.ownerId !== userId) throw new StapeSetupError('Funnel not found', 404);
  if (funnel.status !== 'approved') throw new StapeSetupError('Approve this funnel before setting up Stape.', 400);
  return funnel;
}

export async function loadStapeConnection(userId: string) {
  const connection = await prisma.stapeConnection.findUnique({ where: { userId } });
  if (!connection) throw new StapeSetupError('Add your Stape API key in Settings first.', 400);
  return connection;
}

// Best-effort: pulls the first http(s) URL's hostname out of any step's
// urlPattern to use as the container's primary domain. Good enough for the
// common "whole funnel lives on one domain" case; cross_domain funnels
// override this via the domain-topology inputs on the setup screen anyway.
export function primaryDomainFromSteps(steps: { urlPattern: string }[]): string | null {
  for (const step of steps) {
    try {
      return new URL(step.urlPattern).hostname;
    } catch {
      continue;
    }
  }
  return null;
}

export function allDomainsFromSteps(steps: { urlPattern: string }[]): string[] {
  const domains = new Set<string>();
  for (const step of steps) {
    try {
      domains.add(new URL(step.urlPattern).hostname);
    } catch {
      continue;
    }
  }
  return Array.from(domains);
}
