import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DebugViewChecklist, StapeHealthCheck } from '@/components/ValidationChecklist';

export default async function ValidatePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/signin');
  const userId = (session.user as { id: string }).id;

  const funnel = await prisma.funnel.findUnique({
    where: { id: params.id },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  if (!funnel || funnel.ownerId !== userId) notFound();

  const isServerMode = funnel.setupMode === 'server';

  return (
    <main style={{ maxWidth: 700, margin: '0 auto', padding: '32px 20px' }}>
      <Link href={`/funnels/${funnel.id}/gtm-setup`} className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
        &larr; Back to setup
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginTop: 16, marginBottom: 4 }}>Validate</h1>
      <p style={{ fontSize: 13, color: 'var(--line-secondary)', marginTop: 0, marginBottom: 24, lineHeight: 1.55 }}>
        Trigger each step on your live site, then confirm it below.
      </p>

      <div className="section-label mono" style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--line-secondary)', marginBottom: 4 }}>
        GA4 DebugView
      </div>
      <p style={{ fontSize: 12, color: 'var(--line-secondary)', marginTop: 0, marginBottom: 12, lineHeight: 1.5 }}>
        DebugView isn't readable through an API — open GA4, turn on debug mode for your test session (the GA4 Debugger
        Chrome extension or a <span className="mono">?_dbg=1</span> visit both work), trigger the step, then check it off
        once you see it land.
      </p>
      <a
        href="https://analytics.google.com/"
        target="_blank"
        rel="noreferrer"
        className="btn"
        style={{ textDecoration: 'none', display: 'inline-block', marginBottom: 20 }}
      >
        Open GA4 DebugView →
      </a>

      <DebugViewChecklist funnelId={funnel.id} steps={funnel.steps} />

      {isServerMode && (
        <>
          <div
            className="mono"
            style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--line-secondary)', marginTop: 28, marginBottom: 12 }}
          >
            Server container health
          </div>
          <div style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 14 }}>
            <p style={{ fontSize: 12.5, color: 'var(--line-secondary)', margin: '0 0 10px' }}>
              Confirms <span className="mono">{funnel.stapeContainerUrl ?? 'the container'}</span> resolves and is
              responding — a client-side setup has no container, so this check doesn't apply there.
            </p>
            <StapeHealthCheck funnelId={funnel.id} initialStatus={funnel.stapeContainerStatus} />
          </div>
        </>
      )}
    </main>
  );
}
