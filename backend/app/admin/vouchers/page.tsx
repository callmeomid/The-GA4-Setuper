import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdminUserId } from '@/lib/admin';
import { VoucherAdminPanel } from '@/components/VoucherAdminPanel';

export default async function AdminVouchersPage() {
  const adminId = await requireAdminUserId();
  if (!adminId) redirect('/dashboard');

  return (
    <main className="dot-grid" style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      <Link href="/dashboard" className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
        &larr; Dashboard
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginTop: 16, marginBottom: 4 }}>Vouchers</h1>
      <p style={{ fontSize: 13, color: 'var(--line-secondary)', marginTop: 0, marginBottom: 20 }}>
        Percent-off and amount-off codes are mirrored to Stripe and typeable at Checkout. Trial-day codes have no Stripe
        equivalent — they only work through the pre-applied links below.
      </p>
      <VoucherAdminPanel />
    </main>
  );
}
