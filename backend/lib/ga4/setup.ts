import { prisma } from '@/lib/prisma';
import { listConversionEvents, listDataStreams } from './api';
import type { ExistingConversionEvent } from './plan';

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
  if (!connection.ga4PropertyId) throw new Ga4SetupError('Select a GA4 property in Settings first.', 400);
  return connection as typeof connection & { ga4PropertyId: string };
}

export async function fetchExistingConversionEvents(
  ctx: { userId?: string; funnelId?: string },
  refreshToken: string,
  propertyId: string,
): Promise<ExistingConversionEvent[]> {
  const events = await listConversionEvents(ctx, refreshToken, propertyId);
  return events.map((e) => ({
    resourceName: e.name ?? '',
    eventName: e.eventName ?? '',
    custom: e.custom ?? true,
  }));
}

// Picks the property's first (usually only) web data stream — used by the
// validation flow to find/create a Measurement Protocol secret. A property
// with no web stream yet (brand new, never received a hit) is a real
// possibility, not an error: callers treat `null` as "can't validate yet."
export async function findWebDataStream(ctx: { userId?: string; funnelId?: string }, refreshToken: string, propertyId: string) {
  const streams = await listDataStreams(ctx, refreshToken, propertyId);
  return streams.find((s) => s.type === 'WEB_DATA_STREAM' && s.webStreamData?.measurementId) ?? null;
}
