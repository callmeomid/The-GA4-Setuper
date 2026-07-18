import { NextResponse } from 'next/server';
import { requireAdminUserId } from '@/lib/admin';
import { createVoucher, VoucherError, VoucherType, VoucherDuration } from '@/lib/billing/vouchers';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const adminId = await requireAdminUserId();
  if (!adminId) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  const vouchers = await prisma.voucher.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ vouchers });
}

export async function POST(request: Request) {
  const adminId = await requireAdminUserId();
  if (!adminId) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const code: string | undefined = body?.code?.trim();
  const type: VoucherType | undefined = body?.type;
  const value: number | undefined = body?.value;

  if (!code) return NextResponse.json({ error: 'code is required' }, { status: 400 });
  if (type !== 'percent_off' && type !== 'amount_off' && type !== 'trial_days') {
    return NextResponse.json({ error: 'type must be percent_off, amount_off, or trial_days' }, { status: 400 });
  }
  if (!Number.isInteger(value) || (value as number) <= 0) {
    return NextResponse.json({ error: 'value must be a positive integer' }, { status: 400 });
  }

  try {
    const voucher = await createVoucher({
      code,
      type,
      value: value as number,
      currency: body?.currency,
      duration: body?.duration as VoucherDuration | undefined,
      durationInMonths: body?.durationInMonths ? Number(body.durationInMonths) : undefined,
      startsAt: body?.startsAt ? new Date(body.startsAt) : undefined,
      endsAt: body?.endsAt ? new Date(body.endsAt) : undefined,
      maxRedemptions: body?.maxRedemptions ? Number(body.maxRedemptions) : undefined,
    });
    return NextResponse.json({ voucher }, { status: 201 });
  } catch (err) {
    if (err instanceof VoucherError) return NextResponse.json({ error: err.message }, { status: err.status });
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'A voucher with this code already exists.' }, { status: 409 });
    }
    const message = err instanceof Error ? err.message : 'Could not create voucher';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
