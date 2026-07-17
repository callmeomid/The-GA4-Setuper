import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ApiLogList } from '@/components/ApiLogList';

export default async function StapeLogPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/signin');
  const userId = (session.user as { id: string }).id;

  const funnel = await prisma.funnel.findUnique({ where: { id: params.id } });
  if (!funnel || funnel.ownerId !== userId) notFound();

  const logs = await prisma.apiLog.findMany({
    where: { funnelId: params.id, system: 'stape' },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      <Link href={`/funnels/${params.id}`} className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
        &larr; Back to funnel
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginTop: 16, marginBottom: 16 }}>Stape API call log</h1>
      <ApiLogList
        logs={logs}
        emptyHint='No calls logged yet — open "Set up in Stape.io" to generate a preview, which already makes read calls against the Stape API.'
      />
    </main>
  );
}
