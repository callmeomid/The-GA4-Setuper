import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Ga4ConnectPanel } from '@/components/Ga4ConnectPanel';
import { ManualMeasurementIdForm } from '@/components/ManualMeasurementIdForm';
import { resolveMeasurementId } from '@/lib/gtm/measurement';

export default async function ConnectGa4Page({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/signin');
  const userId = (session.user as { id: string }).id;

  const funnel = await prisma.funnel.findUnique({ where: { id: params.id } });
  if (!funnel || funnel.ownerId !== userId) notFound();
  if (funnel.status !== 'approved') redirect(`/funnels/${funnel.id}`);

  const connection = await prisma.ga4Connection.findUnique({ where: { userId } });
  const measurementId = await resolveMeasurementId(userId, funnel.ga4MeasurementId);

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px' }}>
      <Link href={`/funnels/${funnel.id}/connect/gtm`} className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
        &larr; Back
      </Link>

      <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.1em', color: 'var(--line-secondary)', textTransform: 'uppercase', marginTop: 20, marginBottom: 8 }}>
        Step 4 · Connect · GA4
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
        Point us at your GA4 property
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--line-secondary)', lineHeight: 1.65, maxWidth: '58ch', margin: '0 0 20px' }}>
        Connecting gives us the measurement ID for the GTM tag <em>and</em> lets the later validate step check GA4&rsquo;s
        realtime report. If you&rsquo;d rather not connect, pasting the measurement ID alone is enough to finish setup —
        you&rsquo;ll just skip live validation.
      </p>

      <div style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 16, marginBottom: 16 }}>
        <div className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', marginBottom: 10 }}>
          Recommended — connect for the full flow
        </div>
        <Ga4ConnectPanel
          connected={Boolean(connection)}
          selectedPropertyName={connection?.ga4PropertyName ?? null}
          selectedMeasurementId={connection?.ga4MeasurementId ?? null}
        />
      </div>

      <details style={{ marginBottom: 22 }} open={!connection}>
        <summary className="mono" style={{ fontSize: 10.5, color: 'var(--line-secondary)', cursor: 'pointer' }}>
          ▸ Don&rsquo;t have access to the GA4 property?
        </summary>
        <div style={{ marginTop: 10, paddingLeft: 12, borderLeft: '1px solid var(--line-ghost)' }}>
          <p style={{ fontSize: 12.5, color: 'var(--line-secondary)', lineHeight: 1.65, margin: '0 0 10px' }}>
            You don&rsquo;t need admin rights to finish this — you only need the measurement ID, and anyone with
            Viewer access in GA4 can see it (Admin → Data Streams → your web stream). Ask the property owner for it
            if you can&rsquo;t see it yourself, then paste it here. You can always connect properly later to unlock
            live validation.
          </p>
          <ManualMeasurementIdForm funnelId={funnel.id} initialValue={funnel.ga4MeasurementId ?? ''} />
        </div>
      </details>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Link
          href={`/funnels/${funnel.id}/connect/stape`}
          className="btn btn-accent"
          style={{ textDecoration: 'none', pointerEvents: measurementId ? 'auto' : 'none', opacity: measurementId ? 1 : 0.35 }}
        >
          Continue →
        </Link>
      </div>
    </main>
  );
}
