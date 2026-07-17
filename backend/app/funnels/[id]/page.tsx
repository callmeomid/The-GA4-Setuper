import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FlowDiagram } from '@/components/FlowDiagram';
import { ApproveButton } from '@/components/ApproveButton';
import { StatusBadge } from '@/components/StatusBadge';

export default async function FunnelDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/signin');
  const userId = (session.user as { id: string }).id;

  const funnel = await prisma.funnel.findUnique({
    where: { id: params.id },
    include: { steps: { orderBy: { order: 'asc' } } },
  });

  if (!funnel || funnel.ownerId !== userId) notFound();

  const approved = funnel.status === 'approved';
  const validated = approved && funnel.steps.length > 0 && funnel.steps.every((s) => s.validatedAt);

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
      <Link href="/dashboard" className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
        &larr; All funnels
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16, marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{funnel.name}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {validated && (
            <span
              className="mono"
              style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 2, border: '1px solid var(--accent)', color: 'var(--accent)' }}
            >
              Live
            </span>
          )}
          <StatusBadge status={funnel.status} />
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--line-secondary)', marginTop: 4, marginBottom: 8, maxWidth: '58ch' }}>
        {funnel.steps.length} steps captured. This is the exact shape of what we&rsquo;ll build in GTM — one trigger
        and one tag per node below. Check the labels and URLs now; it&rsquo;s cheaper to fix here than after
        anything is connected.
      </p>

      <FlowDiagram steps={funnel.steps} approved={approved} />

      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 14 }}>
        {approved ? (
          <>
            <Link
              href={`/funnels/${funnel.id}/preview`}
              className="mono"
              style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}
            >
              View plain-English preview
            </Link>
            {validated ? (
              <Link href={`/funnels/${funnel.id}/validate`} className="btn btn-accent" style={{ textDecoration: 'none' }}>
                Re-check live status →
              </Link>
            ) : (
              <Link href={`/funnels/${funnel.id}/connect/gtm`} className="btn btn-accent" style={{ textDecoration: 'none' }}>
                Set up in Google Tag Manager →
              </Link>
            )}
          </>
        ) : (
          <ApproveButton funnelId={funnel.id} />
        )}
      </div>
    </main>
  );
}
