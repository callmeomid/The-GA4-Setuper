import { prisma } from '@/lib/prisma';

export class Ga4SetupError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function loadFunnelForGa4(userId: string, funnelId: string) {
  const funnel = await prisma.funnel.findUnique({
    where: { id: funnelId },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  if (!funnel || funnel.ownerId !== userId) throw new Ga4SetupError('Funnel not found', 404);
  if (funnel.status !== 'approved') throw new Ga4SetupError('Approve this funnel before setting up GA4.', 400);
  return funnel;
}

export async function loadGa4Connection(userId: string) {
  const connection = await prisma.ga4Connection.findUnique({ where: { userId } });
  if (!connection) throw new Ga4SetupError('Connect Google Analytics in Settings first.', 400);
  if (!connection.ga4PropertyId) {
    throw new Ga4SetupError('Select a GA4 property in Settings first.', 400);
  }
  return connection as typeof connection & { ga4PropertyId: string };
}
