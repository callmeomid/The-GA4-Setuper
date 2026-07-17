import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GtmConnectPanel } from '@/components/GtmConnectPanel';

export default async function ConnectGtmPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/signin');
  const userId = (session.user as { id: string }).id;

  const funnel = await prisma.funnel.findUnique({ where: { id: params.id } });
  if (!funnel || funnel.ownerId !== userId) notFound();
  if (funnel.status !== 'approved') redirect(`/funnels/${funnel.id}`);

  const connection = await prisma.gtmConnection.findUnique({ where: { userId } });
  const ready = Boolean(connection?.gtmContainerId);

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px' }}>
      <Link href={`/funnels/${funnel.id}/preview`} className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
        &larr; Back
      </Link>

      <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.1em', color: 'var(--line-secondary)', textTransform: 'uppercase', marginTop: 20, marginBottom: 8 }}>
        Step 3 · Connect · GTM
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
        Connect Google Tag Manager
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--line-secondary)', lineHeight: 1.65, maxWidth: '58ch', margin: '0 0 20px' }}>
        A GTM container is the single bucket of tags and triggers that fires on your site. We request edit access
        only — never publish — so we can write a draft while you stay the only one who can make it live.
      </p>

      <div style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 16, marginBottom: 16 }}>
        <GtmConnectPanel connected={Boolean(connection)} selectedContainerName={connection?.gtmContainerPublicId ?? null} />
      </div>

      <details style={{ marginBottom: 22 }}>
        <summary className="mono" style={{ fontSize: 10.5, color: 'var(--line-secondary)', cursor: 'pointer' }}>
          ▸ What if this container already has a trigger or tag for one of my steps?
        </summary>
        <p style={{ fontSize: 12.5, color: 'var(--line-secondary)', lineHeight: 1.6, margin: '8px 0 0', paddingLeft: 12, borderLeft: '1px solid var(--line-ghost)' }}>
          The next preview flags it per step instead of blocking the whole funnel — you&rsquo;ll see a{' '}
          <span style={{ color: 'var(--danger)' }}>conflict</span> badge with the exact name that collided, and can
          rename that step&rsquo;s event to resolve it before anything is pushed.
        </p>
      </details>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Link
          href={`/funnels/${funnel.id}/connect/ga4`}
          className="btn btn-accent"
          style={{ textDecoration: 'none', pointerEvents: ready ? 'auto' : 'none', opacity: ready ? 1 : 0.35 }}
        >
          Continue →
        </Link>
      </div>
    </main>
  );
}
