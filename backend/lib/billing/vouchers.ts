import type { Voucher } from '@prisma/client';
import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { stripe } from './stripe';

export class VoucherError extends Error {
  status = 400;
}

export type VoucherType = 'percent_off' | 'amount_off' | 'trial_days';
export type VoucherDuration = 'once' | 'repeating' | 'forever';

export type VoucherInput = {
  code: string;
  type: VoucherType;
  value: number;
  currency?: string; // required for amount_off
  duration?: VoucherDuration; // required for percent_off/amount_off
  durationInMonths?: number; // required when duration === 'repeating'
  startsAt?: Date;
  endsAt?: Date;
  maxRedemptions?: number;
};

// Percent/amount vouchers are mirrored into a real Stripe Coupon + PromotionCode
// so the code is typeable at Stripe Checkout's native "Add promotion code" field.
// trial_days vouchers have no Stripe counterpart (see schema.prisma comment) —
// they only work through the pre-applied /billing/redeem link.
export async function createVoucher(input: VoucherInput): Promise<Voucher> {
  if (input.type === 'amount_off' && !input.currency) {
    throw new VoucherError('currency is required for amount_off vouchers');
  }
  if (input.type !== 'trial_days' && !input.duration) {
    throw new VoucherError('duration is required for percent_off/amount_off vouchers');
  }
  if (input.duration === 'repeating' && !input.durationInMonths) {
    throw new VoucherError('durationInMonths is required when duration is "repeating"');
  }

  let stripeCouponId: string | undefined;
  let stripePromotionCodeId: string | undefined;

  if (input.type === 'percent_off' || input.type === 'amount_off') {
    const redeemBy = input.endsAt ? Math.floor(input.endsAt.getTime() / 1000) : undefined;
    const coupon = await stripe.coupons.create({
      percent_off: input.type === 'percent_off' ? input.value : undefined,
      amount_off: input.type === 'amount_off' ? input.value : undefined,
      currency: input.type === 'amount_off' ? input.currency : undefined,
      duration: input.duration!,
      duration_in_months: input.duration === 'repeating' ? input.durationInMonths : undefined,
      max_redemptions: input.maxRedemptions,
      redeem_by: redeemBy,
    });
    const promotionCode = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code: input.code,
      active: true,
      max_redemptions: input.maxRedemptions,
      expires_at: redeemBy,
    });
    stripeCouponId = coupon.id;
    stripePromotionCodeId = promotionCode.id;
  }

  return prisma.voucher.create({
    data: {
      code: input.code,
      type: input.type,
      value: input.value,
      currency: input.currency,
      duration: input.duration,
      durationInMonths: input.durationInMonths,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      maxRedemptions: input.maxRedemptions,
      stripeCouponId,
      stripePromotionCodeId,
    },
  });
}

export async function setVoucherActive(id: string, active: boolean): Promise<Voucher> {
  const voucher = await prisma.voucher.update({ where: { id }, data: { active } });
  if (voucher.stripePromotionCodeId) {
    // Stripe coupons can't be deactivated directly, but deactivating the
    // promotion code blocks it from being typed in at Checkout, which is the
    // only place a bare coupon could otherwise be reached from.
    await stripe.promotionCodes.update(voucher.stripePromotionCodeId, { active });
  }
  return voucher;
}

// Read-only eligibility check for the pre-applied /billing/redeem link path.
// The typed-at-Checkout path doesn't call this — Stripe validates that one
// itself using the mirrored PromotionCode's own active/expires_at/max_redemptions.
export async function validateVoucherForRedeemLink(code: string): Promise<Voucher> {
  const voucher = await prisma.voucher.findUnique({ where: { code } });
  if (!voucher) throw new VoucherError('This code is not valid.');
  if (!voucher.active) throw new VoucherError('This code is no longer active.');
  const now = new Date();
  if (voucher.startsAt && now < voucher.startsAt) throw new VoucherError('This code is not valid yet.');
  if (voucher.endsAt && now > voucher.endsAt) throw new VoucherError('This code has expired.');
  if (voucher.maxRedemptions !== null && voucher.timesRedeemed >= voucher.maxRedemptions) {
    throw new VoucherError('This code has reached its redemption limit.');
  }
  return voucher;
}

// Checkout Session params specific to redeeming this voucher via the
// pre-applied link. Checkout rejects combining `discounts` with
// `allow_promotion_codes: true`, so the caller must leave that off when
// spreading these overrides in.
export function voucherCheckoutOverrides(voucher: Voucher): Partial<Stripe.Checkout.SessionCreateParams> {
  if (voucher.type === 'trial_days') {
    return { subscription_data: { trial_period_days: voucher.value } };
  }
  return { discounts: [{ coupon: voucher.stripeCouponId! }] };
}

export async function incrementVoucherRedemptionByCode(code: string): Promise<void> {
  await prisma.voucher.updateMany({ where: { code }, data: { timesRedeemed: { increment: 1 } } });
}

export async function incrementVoucherRedemptionByPromotionCodeId(promotionCodeId: string): Promise<void> {
  await prisma.voucher.updateMany({ where: { stripePromotionCodeId: promotionCodeId }, data: { timesRedeemed: { increment: 1 } } });
}
