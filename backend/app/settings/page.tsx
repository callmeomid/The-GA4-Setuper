import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GtmConnectPanel } from '@/components/GtmConnectPanel';
import { Ga4ConnectPanel } from '@/components/Ga4ConnectPanel';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/signin');
  const userId = (session.user as { id: string }).id;

  const [gtmConnection, ga4Connection] = await Promise.all([
    prisma.gtmConnection.findUnique({ where: { userId } }),
    prisma.ga4Connection.findUnique({ where: { userId } }),
  ]);

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px' }}>
      <Link href="/dashboard" className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
        &larr; Dashboard
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginTop: 16, marginBottom: 4 }}>Settings</h1>

      <div style={{ marginTop: 24, marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Google Tag Manager</h2>
        <p style={{ fontSize: 13, color: 'var(--line-secondary)', marginTop: 0, marginBottom: 14 }}>
          Connect Google Tag Manager so approved funnels can be set up as a draft in your container. This is a
          separate permission from signing in — we only ask for it here, and we never request permission to publish
          on your behalf.
        </p>
        <GtmConnectPanel
          connected={Boolean(gtmConnection)}
          selectedContainerName={gtmConnection?.gtmContainerPublicId ?? null}
        />
      </div>

      <div>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Google Analytics</h2>
        <p style={{ fontSize: 13, color: 'var(--line-secondary)', marginTop: 0, marginBottom: 14 }}>
          A third, separate permission — read-only, and only used so the validate step can check whether an event
          actually arrived in GA4&rsquo;s realtime report. It can never change anything in GA4.
        </p>
        <Ga4ConnectPanel
          connected={Boolean(ga4Connection)}
          selectedPropertyName={ga4Connection?.ga4PropertyName ?? null}
          selectedMeasurementId={ga4Connection?.ga4MeasurementId ?? null}
        />
      </div>
    </main>
  );
}
