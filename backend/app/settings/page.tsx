import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { effectivePlan } from '@/lib/billing/plans';
import { prisma } from '@/lib/prisma';
import { ApiKeyPanel } from '@/components/ApiKeyPanel';
import { BillingPanel } from '@/components/BillingPanel';
import { GtmConnectPanel } from '@/components/GtmConnectPanel';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { voucherError?: string; upgraded?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  const userId = (session.user as { id: string }).id;

  const [connection, user, pushedCount] = await Promise.all([
    prisma.gtmConnection.findUnique({ where: { userId } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.funnel.count({ where: { ownerId: userId, firstPushedAt: { not: null } } }),
  ]);
  const plan = effectivePlan(user);

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px' }}>
      <Link href="/dashboard" className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
        &larr; Dashboard
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginTop: 16, marginBottom: 4 }}>Settings</h1>

      <BillingPanel
        planId={plan.id}
        planLabel={plan.label}
        planStatus={user.planStatus}
        pushedCount={pushedCount}
        funnelPushLimit={plan.funnelPushLimit}
        hasStripeCustomer={Boolean(user.stripeCustomerId)}
        voucherError={searchParams.voucherError ?? null}
        upgraded={searchParams.upgraded === '1'}
      />

      <ApiKeyPanel apiKey={user.apiKey} />

      <p style={{ fontSize: 13, color: 'var(--line-secondary)', marginTop: 0, marginBottom: 20 }}>
        Connect Google Tag Manager so approved funnels can be set up as a draft in your container. This is a separate
        permission from signing in — we only ask for it here, and we never request permission to publish on your behalf.
      </p>
      <GtmConnectPanel
        connected={Boolean(connection)}
        selectedContainerName={connection?.gtmContainerPublicId ?? null}
      />
    </main>
  );
}
