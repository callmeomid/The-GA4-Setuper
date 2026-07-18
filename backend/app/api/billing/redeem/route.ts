import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getOrCreateStripeCustomerId } from '@/lib/billing/customer';
import { PlanId, stripePriceIdFor } from '@/lib/billing/plans';
import { appUrl, stripe } from '@/lib/billing/stripe';
import { validateVoucherForRedeemLink, voucherCheckoutOverrides, VoucherError } from '@/lib/billing/vouchers';

// The pre-applied voucher link: /api/billing/redeem?voucher=CODE&plan=pro
// Unlike /api/billing/checkout, this pre-attaches the voucher's discount or
// trial directly on the Checkout Session — required for trial_days vouchers,
// which have no Stripe Coupon/PromotionCode counterpart to type in manually.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('voucher');
  const plan = url.searchParams.get('plan') as PlanId | null;

  if (!code || (plan !== 'pro' && plan !== 'business')) {
    return NextResponse.redirect(appUrl('/settings?voucherError=' + encodeURIComponent('This link is missing or malformed.')));
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    const callbackUrl = `/api/billing/redeem?voucher=${encodeURIComponent(code)}&plan=${plan}`;
    return NextResponse.redirect(appUrl(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`));
  }
  const userId = (session.user as { id: string }).id;

  let voucher;
  try {
    voucher = await validateVoucherForRedeemLink(code);
  } catch (err) {
    const message = err instanceof VoucherError ? err.message : 'This code could not be redeemed.';
    return NextResponse.redirect(appUrl(`/settings?voucherError=${encodeURIComponent(message)}`));
  }

  let priceId: string;
  try {
    priceId = stripePriceIdFor(plan);
  } catch {
    return NextResponse.redirect(appUrl('/settings?voucherError=' + encodeURIComponent('Billing is not configured yet.')));
  }

  const customerId = await getOrCreateStripeCustomerId(userId);

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    // Never combined with allow_promotion_codes — Checkout rejects `discounts`
    // + `allow_promotion_codes: true` together, and this session already
    // represents one specific voucher redemption.
    success_url: appUrl('/settings?upgraded=1'),
    cancel_url: appUrl('/settings'),
    metadata: { userId, plan, voucherCode: voucher.code },
    subscription_data: { metadata: { userId, plan, voucherCode: voucher.code } },
    ...voucherCheckoutOverrides(voucher),
  });

  return NextResponse.redirect(checkoutSession.url!);
}
