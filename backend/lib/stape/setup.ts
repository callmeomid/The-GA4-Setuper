import { prisma } from '@/lib/prisma';
import { createContainer, getContainer, type StapeContainer } from './client';

// Mirrors getOrCreateWorkspace's idempotency: if this funnel already has a
// container tied to the same subdomain, reuse it instead of provisioning a
// second one on every re-run of the push. Changing the subdomain creates a
// new container rather than trying to rename one in place.
export async function ensureStapeContainer(
  funnelId: string,
  existing: { stapeContainerId: string | null; stapeSubdomain: string | null },
  subdomain: string,
  cookieName: string,
  siteName: string,
): Promise<StapeContainer & { url: string }> {
  const container =
    existing.stapeContainerId && existing.stapeSubdomain === subdomain
      ? await getContainer(existing.stapeContainerId)
      : await createContainer(subdomain, siteName);

  const url = `https://${container.domain}`;
  await prisma.funnel.update({
    where: { id: funnelId },
    data: {
      stapeContainerId: container.id,
      stapeSubdomain: subdomain,
      stapeContainerUrl: url,
      stapeContainerStatus: 'created',
      stapeCookieName: cookieName,
    },
  });

  return { ...container, url };
}
