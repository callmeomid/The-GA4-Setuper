import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildDryRunPreview } from '@/lib/gtm/preview';

export default async function FunnelPreviewPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/signin');
  const userId = (session.user as { id: string }).id;

  const funnel = await prisma.funnel.findUnique({
    where: { id: params.id },
    include: { steps: { orderBy: { order: 'asc' } } },
  });

  if (!funnel || funnel.ownerId !== userId) notFound();
  if (funnel.status !== 'approved') redirect(`/funnels/${funnel.id}`);

  const dryRun = buildDryRunPreview(
    funnel.steps.map((s) => ({
      id: s.id,
      order: s.order,
      triggerType: s.triggerType,
      urlPattern: s.urlPattern,
      selector: s.selector,
      label: s.label,
    })),
  );

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px' }}>
      <Link href={`/funnels/${funnel.id}`} className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
        &larr; Back to funnel
      </Link>

      <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.1em', color: 'var(--accent)', textTransform: 'uppercase', marginTop: 20, marginBottom: 8 }}>
        Before you connect anything
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
        Here&rsquo;s exactly what we&rsquo;re about to do.
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--line-secondary)', lineHeight: 1.65, maxWidth: '58ch', margin: '0 0 22px' }}>
        No account is connected yet. This is a dry run based only on the {funnel.steps.length} step
        {funnel.steps.length === 1 ? '' : 's'} you recorded, so you can see the shape of the change before granting
        access to anything.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 8 }}>
        <SystemPanel
          name="GTM"
          body={`We'll create ${dryRun.length} trigger${dryRun.length === 1 ? '' : 's'} and ${dryRun.length} tag${dryRun.length === 1 ? '' : 's'} in a draft workspace inside your container. Draft only — nothing publishes without you clicking Publish yourself, inside GTM, not here.`}
          why={{ q: 'What’s a "container"?', a: 'The single bucket of tags and triggers that fires on your site. You likely already have one if you’ve ever added Google Ads or a Meta pixel.' }}
        />
        <SystemPanel
          name="GA4"
          body="Each tag fires a GA4 event, with an editable event name. If a GA4 Configuration tag already exists in your container, we reuse it instead of creating a duplicate."
          why={{ q: 'Do I need to be a GA4 admin?', a: 'No — the tag lives in GTM. GA4 just needs to be told which measurement ID to send to.' }}
        />
        <SystemPanel
          name="Stape"
          body="Events route through a small server on a subdomain you own, like sgtm.yoursite.com. That keeps requests off a third-party domain, so ad blockers and Safari's tracking prevention don't eat them."
          why={{ q: 'Why does it need my own subdomain?', a: 'Browsers treat first-party subdomains very differently from third-party tracking domains. Routing through yours is what makes this "server-side."' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
        {dryRun.map((step) => (
          <div key={step.stepId} style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 14 }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--line-secondary)', marginBottom: 4 }}>
              STEP {String(step.order).padStart(2, '0')}
            </div>
            <div style={{ fontSize: 13.5, marginBottom: 8 }}>{step.label}</div>
            <p style={{ fontSize: 12.5, color: 'var(--line-secondary)', margin: '0 0 6px' }}>
              <strong style={{ color: 'var(--line-primary)' }}>Trigger — </strong>
              {step.triggerDescription}
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--line-secondary)', margin: 0 }}>
              <strong style={{ color: 'var(--line-primary)' }}>Tag — </strong>
              {step.tagDescription}
            </p>
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--accent)', marginTop: 8 }}>
              event name: {step.eventName}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/settings" className="btn btn-accent" style={{ textDecoration: 'none' }}>
          Looks right — connect my accounts →
        </Link>
      </div>
    </main>
  );
}

function SystemPanel({ name, body, why }: { name: string; body: string; why: { q: string; a: string } }) {
  return (
    <div style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 14, background: 'var(--bg-raised)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13 }}>{name}</span>
        <span
          className="mono"
          style={{
            fontSize: 9,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--line-secondary)',
            border: '1px solid var(--line-ghost)',
            borderRadius: 2,
            padding: '2px 6px',
          }}
        >
          not connected
        </span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--line-secondary)', lineHeight: 1.6, margin: 0 }}>{body}</p>
      <details style={{ marginTop: 10 }}>
        <summary className="mono" style={{ fontSize: 10, color: 'var(--line-secondary)', cursor: 'pointer' }}>
          ▸ {why.q}
        </summary>
        <p style={{ fontSize: 11.5, color: 'var(--line-secondary)', lineHeight: 1.55, margin: '6px 0 0', paddingLeft: 10, borderLeft: '1px solid var(--line-ghost)' }}>
          {why.a}
        </p>
      </details>
    </div>
  );
}
