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
  if (funnel.stapeSpansSubdomains === null) {
    throw new StapeSetupError('Answer whether this funnel spans subdomains before continuing.', 400);
  }
  return funnel;
}

export async function loadStapeConnection(userId: string) {
  const connection = await prisma.stapeConnection.findUnique({ where: { userId } });
  if (!connection) throw new StapeSetupError('Connect your Stape API key in Settings first.', 400);
  return connection;
}
