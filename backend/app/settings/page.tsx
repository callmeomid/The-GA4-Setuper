import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GtmConnectPanel } from '@/components/GtmConnectPanel';
import { Ga4ConnectPanel } from '@/components/Ga4ConnectPanel';
import { StapeConnectPanel } from '@/components/StapeConnectPanel';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/signin');
  const userId = (session.user as { id: string }).id;

  const [gtmConnection, ga4Connection, stapeConnection] = await Promise.all([
    prisma.gtmConnection.findUnique({ where: { userId } }),
    prisma.ga4Connection.findUnique({ where: { userId } }),
    prisma.stapeConnection.findUnique({ where: { userId } }),
  ]);

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px' }}>
      <Link href="/dashboard" className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
        &larr; Dashboard
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginTop: 16, marginBottom: 4 }}>Settings</h1>
      <p style={{ fontSize: 13, color: 'var(--line-secondary)', marginTop: 0, marginBottom: 24 }}>
        Each integration below is its own separate permission grant — connecting one never grants access to the
        others, and none of them can publish or go live on your behalf.
      </p>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Google Tag Manager</h2>
        <p style={{ fontSize: 12.5, color: 'var(--line-secondary)', marginTop: 0, marginBottom: 12 }}>
          Lets approved funnels be set up as a draft workspace in your container. We never request permission to
          publish.
        </p>
        <GtmConnectPanel connected={Boolean(gtmConnection)} selectedContainerName={gtmConnection?.gtmContainerPublicId ?? null} />
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Google Analytics</h2>
        <p style={{ fontSize: 12.5, color: 'var(--line-secondary)', marginTop: 0, marginBottom: 12 }}>
          Lets approved funnels create or confirm custom conversion events in GA4, and (optionally) confirm test
          events via BigQuery or realtime reporting on the validation step.
        </p>
        <Ga4ConnectPanel connected={Boolean(ga4Connection)} selectedPropertyName={ga4Connection?.ga4PropertyDisplayName ?? null} />
      </section>

      <section>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Stape.io</h2>
        <p style={{ fontSize: 12.5, color: 'var(--line-secondary)', marginTop: 0, marginBottom: 12 }}>
          Lets approved funnels set up (or reuse) a Stape server container and first-party domain/cookie config.
          Authenticated with an API key, not OAuth — paste one from your Stape account.
        </p>
        <StapeConnectPanel connected={Boolean(stapeConnection)} />
      </section>
    </main>
  );
}
