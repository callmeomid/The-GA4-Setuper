export type PlanId = 'free' | 'pro' | 'business';

export type PlanDef = {
  id: PlanId;
  label: string;
  // Max distinct funnels that may ever be pushed to GTM. null = unlimited.
  funnelPushLimit: number | null;
  // Monthly price in whole dollars, for display only — the real number lives
  // in the Stripe Price object referenced below.
  priceUsd: number | null;
  stripePriceEnvVar?: 'STRIPE_PRICE_PRO' | 'STRIPE_PRICE_BUSINESS';
};

export const PLANS: Record<PlanId, PlanDef> = {
  free: { id: 'free', label: 'Free', funnelPushLimit: 1, priceUsd: 0 },
  pro: { id: 'pro', label: 'Pro', funnelPushLimit: 10, priceUsd: 29, stripePriceEnvVar: 'STRIPE_PRICE_PRO' },
  business: { id: 'business', label: 'Business', funnelPushLimit: null, priceUsd: 99, stripePriceEnvVar: 'STRIPE_PRICE_BUSINESS' },
};

const ACTIVE_STATUSES = new Set(['active', 'trialing']);

// A subscription that's past_due/canceled/unpaid/incomplete falls back to free
// limits even if `plan` still says "pro" — the webhook hasn't necessarily
// downgraded `plan` itself (that only happens on customer.subscription.deleted),
// so this is the actual gate, not just cosmetic.
export function effectivePlan(user: { plan: string; planStatus: string | null }): PlanDef {
  if (user.planStatus && !ACTIVE_STATUSES.has(user.planStatus)) return PLANS.free;
  return PLANS[user.plan as PlanId] ?? PLANS.free;
}

export function stripePriceIdFor(planId: Exclude<PlanId, 'free'>): string {
  const envVar = PLANS[planId].stripePriceEnvVar!;
  const priceId = process.env[envVar];
  if (!priceId) throw new Error(`${envVar} is not configured`);
  return priceId;
}
