import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deriveEventName } from '@/lib/gtm/event-name';
import { ValidateFlow } from '@/components/ValidateFlow';

export default async function ValidateFunnelPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/signin');
  const userId = (session.user as { id: string }).id;

  const funnel = await prisma.funnel.findUnique({
    where: { id: params.id },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  if (!funnel || funnel.ownerId !== userId) notFound();
  if (funnel.status !== 'approved') redirect(`/funnels/${funnel.id}`);

  const notPushed = !funnel.steps.some((s) => s.gtmStatus === 'created');
  const ga4Connection = await prisma.ga4Connection.findUnique({ where: { userId } });
  const notConnected = !ga4Connection?.ga4PropertyId;

  const initialSteps = funnel.steps.map((s) => ({
    stepId: s.id,
    order: s.order,
    label: s.label,
    eventName: s.ga4EventName ?? deriveEventName(s.label),
    validated: Boolean(s.validatedAt),
  }));

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px' }}>
      <Link href={`/funnels/${funnel.id}/gtm-setup`} className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
        &larr; Back to setup
      </Link>

      <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.1em', color: 'var(--line-secondary)', textTransform: 'uppercase', marginTop: 20, marginBottom: 8 }}>
        Step 6 · Validate
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
        Now let&rsquo;s watch it actually happen.
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--line-secondary)', lineHeight: 1.65, maxWidth: '58ch', margin: '0 0 22px' }}>
        Open your site in another tab and walk through the funnel one more time — same as when you recorded it. Each
        step below lights up the moment we see the matching event arrive in GA4&rsquo;s realtime report.
      </p>

      {notPushed ? (
        <div style={{ border: '1px solid var(--danger)', borderRadius: 2, padding: 14, fontSize: 13, color: 'var(--danger)' }}>
          Push this funnel to GTM before validating it.{' '}
          <Link href={`/funnels/${funnel.id}/gtm-setup`} style={{ color: 'var(--danger)', textDecoration: 'underline' }}>
            Go to GTM setup
          </Link>
        </div>
      ) : notConnected ? (
        <div style={{ border: '1px solid var(--danger)', borderRadius: 2, padding: 14, fontSize: 13, color: 'var(--danger)' }}>
          Connect Google Analytics and select a property before validating.{' '}
          <Link href="/settings" style={{ color: 'var(--danger)', textDecoration: 'underline' }}>
            Go to Settings
          </Link>
        </div>
      ) : (
        <ValidateFlow funnelId={funnel.id} initialSteps={initialSteps} />
      )}
    </main>
  );
}
