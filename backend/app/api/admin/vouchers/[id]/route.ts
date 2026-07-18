import { NextResponse } from 'next/server';
import { requireAdminUserId } from '@/lib/admin';
import { setVoucherActive } from '@/lib/billing/vouchers';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const adminId = await requireAdminUserId();
  if (!adminId) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  if (typeof body?.active !== 'boolean') {
    return NextResponse.json({ error: 'active must be a boolean' }, { status: 400 });
  }

  try {
    const voucher = await setVoucherActive(params.id, body.active);
    return NextResponse.json({ voucher });
  } catch {
    return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });
  }
}
