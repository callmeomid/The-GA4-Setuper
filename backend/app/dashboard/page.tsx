import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SignOutButton } from '@/components/SignOutButton';
import { StatusBadge } from '@/components/StatusBadge';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/signin');
  const userId = (session.user as { id: string }).id;

  const funnels = await prisma.funnel.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { steps: true } } },
  });

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
        <span className="mono" style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--line-secondary)' }}>
          FUNNEL SETUPER
        </span>
        <SignOutButton />
      </div>

      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Your funnels</h1>
      <p style={{ fontSize: 13, color: 'var(--line-secondary)', marginTop: 0, marginBottom: 24 }}>
        Captured from the Chrome extension. Review each one as a flow before approving it for setup.
      </p>

      {funnels.length === 0 ? (
        <div
          className="dot-grid"
          style={{
            border: '1px dashed var(--line-ghost)',
            borderRadius: 2,
            padding: '28px 24px',
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px', letterSpacing: '-0.01em' }}>
            Let&rsquo;s get your first event into GA4.
          </h2>
          <p style={{ fontSize: 13, color: 'var(--line-secondary)', lineHeight: 1.65, maxWidth: '58ch', margin: '0 0 20px' }}>
            Most GA4 setups fail quietly — a tag misfires, an ad blocker eats the request, and nobody notices for
            months. We&rsquo;re going to record one real path through your site, wire it through Tag Manager and a
            server-side relay, and show you the event landing in GA4 before we call anything done.
          </p>

          <div style={{ display: 'flex', alignItems: 'stretch', overflowX: 'auto', padding: '4px 2px', marginBottom: 20 }}>
            {[
              { n: '①', k: 'extension', l: 'Install the extension' },
              { n: '②', k: 'recorder', l: 'Record a funnel on your site' },
              { n: '③', k: 'ga4', l: 'Watch it land in GA4, live' },
            ].map((step, i, arr) => (
              <div key={step.l} style={{ display: 'flex', alignItems: 'stretch' }}>
                <div
                  style={{
                    width: 190,
                    flex: '0 0 190px',
                    border: '1px dashed var(--line-ghost)',
                    borderRadius: 2,
                    padding: '11px 12px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 7,
                  }}
                >
                  <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--line-secondary)' }}>
                    <span>{step.n}</span>
                    <span>{step.k}</span>
                  </div>
                  <div style={{ fontSize: 12.5 }}>{step.l}</div>
                </div>
                {i < arr.length - 1 && (
                  <div
                    style={{
                      flex: '0 0 26px',
                      alignSelf: 'center',
                      height: 0,
                      borderTop: '1px dashed var(--line-ghost)',
                      position: 'relative',
                    }}
                  >
                    <span style={{ position: 'absolute', right: -2, top: -7, fontSize: 11, color: 'var(--line-secondary)' }}>→</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/onboarding/install" className="btn btn-accent" style={{ textDecoration: 'none' }}>
              Install the extension →
            </Link>
            <Link href="/onboarding/record" className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none', alignSelf: 'center' }}>
              I already have the extension
            </Link>
          </div>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {funnels.map((funnel) => (
            <li key={funnel.id}>
              <Link
                href={`/funnels/${funnel.id}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '1px solid var(--line-ghost)',
                  borderRadius: 2,
                  padding: '14px 16px',
                  textDecoration: 'none',
                }}
              >
                <div>
                  <div style={{ fontSize: 14, marginBottom: 4 }}>{funnel.name}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--line-secondary)' }}>
                    {funnel._count.steps} steps · {new Date(funnel.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <StatusBadge status={funnel.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
