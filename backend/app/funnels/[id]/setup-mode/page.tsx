import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SetupModeChooser } from '@/components/SetupModeChooser';

export default async function SetupModePage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  const userId = (session.user as { id: string }).id;

  const funnel = await prisma.funnel.findUnique({ where: { id: params.id } });
  if (!funnel || funnel.ownerId !== userId) notFound();
  if (funnel.status !== 'approved') redirect(`/funnels/${funnel.id}`);

  const currentMode = funnel.setupMode as 'client' | 'server' | null;

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px' }}>
      <Link href={`/funnels/${funnel.id}`} className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
        &larr; Back to funnel
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginTop: 16, marginBottom: 4 }}>
        {currentMode ? 'Change setup path' : 'How should this funnel send data?'}
      </h1>
      <p style={{ fontSize: 13, color: 'var(--line-secondary)', marginTop: 0, marginBottom: 24, maxWidth: 620, lineHeight: 1.55 }}>
        {currentMode
          ? 'Both options send events to the same GA4 property. Switching only changes how they get there — nothing about the funnel itself is re-captured.'
          : 'Both options send events to the same GA4 property. This choice only changes how they get there — you can add server-side later without redoing the funnel.'}
      </p>

      <SetupModeChooser funnelId={funnel.id} currentMode={currentMode} />
    </main>
  );
}
