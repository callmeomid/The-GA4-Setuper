import { prisma } from '@/lib/prisma';
import { effectivePlan } from './plans';

export class BillingLimitError extends Error {
  status = 402;
  upgradeUrl = '/settings#billing';
  constructor(message: string) {
    super(message);
  }
}

// Checks the funnel-push cap and, if the funnel hasn't been pushed before,
// atomically claims a slot by stamping firstPushedAt — all inside one
// transaction, so the count-check and the claim can never race each other.
// Runs BEFORE any GTM API call. If this throws, nothing has been written to
// GTM yet, so there's no partial push to worry about cleaning up.
//
// Returns whether this call newly claimed a slot (so the caller knows whether
// to refund it on total failure — see refundPushClaimOnFailure below).
export async function assertCanPushFunnel(userId: string, funnelId: string): Promise<{ claimedNewSlot: boolean }> {
  return prisma.$transaction(async (tx) => {
    const funnel = await tx.funnel.findUniqueOrThrow({ where: { id: funnelId }, select: { firstPushedAt: true } });
    if (funnel.firstPushedAt) return { claimedNewSlot: false };

    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true, planStatus: true } });
    const plan = effectivePlan(user);

    if (plan.funnelPushLimit !== null) {
      const pushedCount = await tx.funnel.count({ where: { ownerId: userId, firstPushedAt: { not: null } } });
      if (pushedCount >= plan.funnelPushLimit) {
        throw new BillingLimitError(
          `Your ${plan.label} plan allows ${plan.funnelPushLimit} live funnel${plan.funnelPushLimit === 1 ? '' : 's'}. Upgrade to push more.`,
        );
      }
    }

    await tx.funnel.update({ where: { id: funnelId }, data: { firstPushedAt: new Date() } });
    return { claimedNewSlot: true };
  });
}

// Called from the outer catch in the gtm-push route: if this request claimed a
// new slot but the push then failed completely (no trigger/tag ever reached
// GTM — e.g. the workspace call itself threw), give the slot back rather than
// charging the user for a push that never actually touched their container.
export async function refundPushClaimOnFailure(funnelId: string, claimedNewSlot: boolean): Promise<void> {
  if (!claimedNewSlot) return;
  await prisma.funnel.update({ where: { id: funnelId }, data: { firstPushedAt: null } });
}
