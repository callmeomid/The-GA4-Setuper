import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { PlanId } from '@/lib/billing/plans';
import { stripe } from '@/lib/billing/stripe';
import { incrementVoucherRedemptionByCode, incrementVoucherRedemptionByPromotionCodeId } from '@/lib/billing/vouchers';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

function planFromPriceId(priceId: string | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro';
  if (priceId === process.env.STRIPE_PRICE_BUSINESS) return 'business';
  return null;
}

async function syncSubscriptionToUser(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
  if (!user) return;

  const priceId = subscription.items.data[0]?.price.id;
  const plan = planFromPriceId(priceId) ?? (subscription.metadata?.plan as PlanId | undefined) ?? user.plan;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan,
      planStatus: subscription.status,
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });
}

async function creditVoucherRedemption(session: Stripe.Checkout.Session) {
  const voucherCode = session.metadata?.voucherCode;
  if (voucherCode) {
    await incrementVoucherRedemptionByCode(voucherCode);
    return;
  }
  // Typed-in-at-Checkout path (allow_promotion_codes) — the completed session
  // doesn't carry metadata for it, so look at which discount actually applied.
  const full = await stripe.checkout.sessions.retrieve(session.id, { expand: ['discounts'] });
  for (const discount of full.discounts ?? []) {
    if (discount.promotion_code) {
      const promotionCodeId = typeof discount.promotion_code === 'string' ? discount.promotion_code : discount.promotion_code.id;
      await incrementVoucherRedemptionByPromotionCodeId(promotionCodeId);
    }
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'subscription' && session.subscription) {
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscriptionToUser(subscription);
      }
      await creditVoucherRedemption(session);
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscriptionToUser(subscription);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
