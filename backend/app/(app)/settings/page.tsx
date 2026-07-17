import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GtmConnectPanel } from '@/components/GtmConnectPanel';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/signin');
  const userId = (session.user as { id: string }).id;

  const connection = await prisma.gtmConnection.findUnique({ where: { userId } });

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px' }}>
      <Link href="/dashboard" className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
        &larr; Dashboard
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginTop: 16, marginBottom: 4 }}>Settings</h1>
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
