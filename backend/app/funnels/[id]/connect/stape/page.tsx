import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { StapeSubdomainForm } from '@/components/StapeSubdomainForm';

export default async function ConnectStapePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/signin');
  const userId = (session.user as { id: string }).id;

  const funnel = await prisma.funnel.findUnique({ where: { id: params.id } });
  if (!funnel || funnel.ownerId !== userId) notFound();
  if (funnel.status !== 'approved') redirect(`/funnels/${funnel.id}`);

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px' }}>
      <Link href={`/funnels/${funnel.id}/connect/ga4`} className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
        &larr; Back
      </Link>

      <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.1em', color: 'var(--line-secondary)', textTransform: 'uppercase', marginTop: 20, marginBottom: 8 }}>
        Step 5 · Connect · Stape
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
        Set up your server-side relay
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--line-secondary)', lineHeight: 1.65, maxWidth: '58ch', margin: '0 0 20px' }}>
        Stape runs a small server between your site and Google, on a subdomain you own — like sgtm.yoursite.com.
        That&rsquo;s what makes this &ldquo;server-side&rdquo;: the request looks like it&rsquo;s going to your own
        domain, not a third-party tracker, so it survives ad blockers and Safari&rsquo;s tracking prevention.
      </p>

      <div style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 16, marginBottom: 16 }}>
        <div className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', marginBottom: 10 }}>
          We don&rsquo;t manage Stape for you — paste the subdomain from your own Stape container.
        </div>
        <StapeSubdomainForm funnelId={funnel.id} initialValue={funnel.stapeSubdomain ?? ''} />
      </div>

      <details style={{ marginBottom: 22 }}>
        <summary className="mono" style={{ fontSize: 10.5, color: 'var(--line-secondary)', cursor: 'pointer' }}>
          ▸ I don&rsquo;t have a Stape container yet
        </summary>
        <p style={{ fontSize: 12.5, color: 'var(--line-secondary)', lineHeight: 1.6, margin: '8px 0 0', paddingLeft: 12, borderLeft: '1px solid var(--line-ghost)' }}>
          Create one at{' '}
          <a href="https://stape.io" target="_blank" rel="noreferrer" style={{ color: 'var(--line-primary)' }}>
            stape.io
          </a>{' '}
          — it&rsquo;ll assign you a server container and walk you through pointing a CNAME record at it from your
          own DNS provider. Come back here and paste that hostname once it&rsquo;s live. Or skip this step entirely:
          your GA4 tag still works without it, just without the ad-blocker resistance a server-side relay gives you.
        </p>
      </details>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Link href={`/funnels/${funnel.id}/gtm-setup`} className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none', alignSelf: 'center' }}>
          Skip for now
        </Link>
        <Link href={`/funnels/${funnel.id}/gtm-setup`} className="btn btn-accent" style={{ textDecoration: 'none' }}>
          Continue →
        </Link>
      </div>
    </main>
  );
}
