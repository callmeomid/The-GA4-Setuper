import { prisma } from '@/lib/prisma';

// A funnel's own measurementId (typed in manually, or from a prior run)
// always wins. Otherwise fall back to the account-level GA4 connection's
// default, so a user who connected GA4 via OAuth once in Settings never has
// to paste the same measurement ID into every new funnel.
export async function resolveMeasurementId(userId: string, funnelMeasurementId: string | null): Promise<string | null> {
  if (funnelMeasurementId) return funnelMeasurementId;
  const connection = await prisma.ga4Connection.findUnique({ where: { userId } });
  return connection?.ga4MeasurementId ?? null;
}

// A Stape subdomain the user typed is just a hostname (e.g. "sgtm.example.com")
// — normalize it into the full https:// URL the GA4 Configuration tag's
// server_container_url parameter expects.
export function stapeServerContainerUrl(stapeSubdomain: string | null): string | null {
  if (!stapeSubdomain) return null;
  const trimmed = stapeSubdomain.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
