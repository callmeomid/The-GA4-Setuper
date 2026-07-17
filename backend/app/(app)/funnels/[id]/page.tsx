import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FunnelFlowPanel } from '@/components/FunnelFlowPanel';
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

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
      <Link href="/dashboard" className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
        &larr; All funnels
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16, marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{funnel.name}</h1>
        <StatusBadge status={funnel.status} />
      </div>
      <p style={{ fontSize: 13, color: 'var(--line-secondary)', marginTop: 4, marginBottom: 8 }}>
        {funnel.steps.length} steps captured. Scan the flow below, then approve it to move to setup.
      </p>

      <FunnelFlowPanel funnelId={funnel.id} steps={funnel.steps} initialApproved={approved} />
    </main>
  );
}
