import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getOrCreateStripeCustomerId } from '@/lib/billing/customer';
import { PlanId, stripePriceIdFor } from '@/lib/billing/plans';
import { appUrl, stripe } from '@/lib/billing/stripe';

// Starts a normal (non-voucher) upgrade to Pro or Business. Stripe Checkout's
// built-in promo-code field (allow_promotion_codes) covers typed-in vouchers
// for this path — the dedicated /billing/redeem route is only needed for
// pre-applied voucher links.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const body = await request.json().catch(() => ({}));
  const plan: PlanId | undefined = body?.plan;
  if (plan !== 'pro' && plan !== 'business') {
    return NextResponse.json({ error: 'plan must be "pro" or "business"' }, { status: 400 });
  }

  let priceId: string;
  try {
    priceId = stripePriceIdFor(plan);
  } catch {
    return NextResponse.json({ error: 'Billing is not configured yet.' }, { status: 500 });
  }

  const customerId = await getOrCreateStripeCustomerId(userId);

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: appUrl('/settings?upgraded=1'),
    cancel_url: appUrl('/settings'),
    metadata: { userId, plan },
    subscription_data: { metadata: { userId, plan } },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
