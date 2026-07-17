import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GtmConnectPanel } from '@/components/GtmConnectPanel';
import { Ga4ConnectPanel } from '@/components/Ga4ConnectPanel';
import { StapeConnectPanel } from '@/components/StapeConnectPanel';

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: '1px solid var(--line-ghost)', paddingTop: 20, marginTop: 20 }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, marginTop: 0, marginBottom: 4 }}>{title}</h2>
      <p style={{ fontSize: 12.5, color: 'var(--line-secondary)', marginTop: 0, marginBottom: 14 }}>{description}</p>
      {children}
    </div>
  );
}

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
      <p style={{ fontSize: 13, color: 'var(--line-secondary)', marginTop: 0, marginBottom: 4 }}>
        Each of these is a separate permission from signing in — granted only when you connect it here.
      </p>

      <Section
        title="Google Tag Manager"
        description="Approved funnels get set up as a draft in your container. We never request permission to publish on your behalf."
      >
        <GtmConnectPanel connected={Boolean(gtmConnection)} selectedContainerName={gtmConnection?.gtmContainerPublicId ?? null} />
      </Section>

      <Section
        title="Google Analytics 4"
        description="Approved funnels get their steps marked as conversion events in your GA4 property. Unlike GTM, GA4 has no draft mode — writes here take effect on the live property immediately, which the setup preview says explicitly before you push."
      >
        <Ga4ConnectPanel connected={Boolean(ga4Connection)} selectedPropertyDisplayName={ga4Connection?.ga4PropertyDisplayName ?? null} />
      </Section>

      <Section
        title="Stape.io"
        description="Creates (or reuses) a server-side GTM container and first-party collection domain per funnel. Stape has no OAuth, so this is a personal API key instead."
      >
        <StapeConnectPanel connected={Boolean(stapeConnection)} />
      </Section>
    </main>
  );
}
