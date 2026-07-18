import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { OpsFunnelActions } from '@/components/OpsFunnelActions';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const OUTCOME_COLOR: Record<string, string> = {
  success: 'var(--accent)',
  partial: 'var(--danger)',
  failed: 'var(--line-secondary)',
};

function OutcomePill({ outcome }: { outcome: string }) {
  const color = OUTCOME_COLOR[outcome] ?? 'var(--line-secondary)';
  return (
    <span
      className="mono"
      style={{ fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color, border: `1px solid ${color}`, borderRadius: 2, padding: '2px 6px' }}
    >
      {outcome}
    </span>
  );
}

export default async function OpsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/signin');

  // Not a normal permission check (no roles in this app) — this page exists
  // for the one person operating client GTM/GA4 setups, not for clients, so
  // it's gated by a single admin email rather than added to the data model.
  const adminEmail = process.env.ADMIN_EMAIL;
  const userEmail = (session.user as { email?: string }).email;
  if (!adminEmail || userEmail !== adminEmail) notFound();

  const [recentAttempts, totalByProvider, errorByProvider, workspaceFunnels] = await Promise.all([
    prisma.pushAttempt.findMany({
      orderBy: { startedAt: 'desc' },
      take: 30,
      include: { funnel: { select: { name: true, owner: { select: { email: true } } } } },
    }),
    prisma.integrationApiLog.groupBy({ by: ['provider'], _count: { _all: true } }),
    prisma.integrationApiLog.groupBy({ by: ['provider'], where: { errorMessage: { not: null } }, _count: { _all: true } }),
    prisma.funnel.findMany({
      where: { gtmWorkspaceId: { not: null } },
      select: {
        id: true,
        name: true,
        owner: { select: { email: true } },
        pushAttempts: { orderBy: { startedAt: 'desc' }, take: 1 },
      },
    }),
  ]);

  const errorCount = new Map(errorByProvider.map((r) => [r.provider, r._count._all]));
  const providerStats = totalByProvider
    .map((r) => {
      const errors = errorCount.get(r.provider) ?? 0;
      const total = r._count._all;
      return { provider: r.provider, total, errors, successRate: total === 0 ? 1 : (total - errors) / total };
    })
    .sort((a, b) => b.total - a.total);

  const stuckFunnels = workspaceFunnels.filter((f) => f.pushAttempts[0]?.outcome === 'partial');

  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span className="mono" style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--line-secondary)' }}>
          FUNNEL SETUPER — OPS
        </span>
        <Link href="/dashboard" className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
          &larr; Back to dashboard
        </Link>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginTop: 12, marginBottom: 4 }}>Ops</h1>
      <p style={{ fontSize: 13, color: 'var(--line-secondary)', marginTop: 0, marginBottom: 28 }}>
        Internal only. Not shown to clients.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 className="mono" style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--line-secondary)', marginBottom: 10 }}>
          FUNNELS STUCK PARTIAL ({stuckFunnels.length})
        </h2>
        {stuckFunnels.length === 0 ? (
          <div className="dot-grid" style={{ border: '1px dashed var(--line-ghost)', borderRadius: 2, padding: 16, fontSize: 12.5, color: 'var(--line-secondary)' }}>
            None. Every funnel with a GTM workspace is either fully wired or untouched.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stuckFunnels.map((f) => {
              const attempt = f.pushAttempts[0];
              return (
                <div
                  key={f.id}
                  style={{ border: '1px solid var(--danger)', borderRadius: 2, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
                >
                  <div>
                    <div style={{ fontSize: 13, marginBottom: 2 }}>
                      <Link href={`/funnels/${f.id}/gtm-setup`} style={{ color: 'var(--line-primary)' }}>
                        {f.name}
                      </Link>
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--line-secondary)' }}>
                      {f.owner.email} · {attempt.stepsOk}/{attempt.stepsTotal} steps ok · {new Date(attempt.startedAt).toLocaleString()}
                    </div>
                  </div>
                  <OpsFunnelActions funnelId={f.id} />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 className="mono" style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--line-secondary)', marginBottom: 10 }}>
          SUCCESS RATE PER INTEGRATION
        </h2>
        {providerStats.length === 0 ? (
          <div className="dot-grid" style={{ border: '1px dashed var(--line-ghost)', borderRadius: 2, padding: 16, fontSize: 12.5, color: 'var(--line-secondary)' }}>
            No API calls logged yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {providerStats.map((p) => (
              <div key={p.provider} style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="mono" style={{ fontSize: 12, textTransform: 'uppercase' }}>{p.provider}</span>
                <span className="mono" style={{ fontSize: 11, color: p.errors > 0 ? 'var(--danger)' : 'var(--line-secondary)' }}>
                  {(p.successRate * 100).toFixed(1)}% ok · {p.total - p.errors}/{p.total} calls · {p.errors} error{p.errors === 1 ? '' : 's'}
                </span>
              </div>
            ))}
            <p style={{ fontSize: 11, color: 'var(--line-secondary)', marginTop: 2 }}>
              GA4 and Stape have no live API calls yet — they'll appear here once those integrations start writing
              through the same logging path GTM uses (<span className="mono">IntegrationApiLog</span>).
            </p>
          </div>
        )}
      </section>

      <section>
        <h2 className="mono" style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--line-secondary)', marginBottom: 10 }}>
          RECENT SETUP ATTEMPTS
        </h2>
        {recentAttempts.length === 0 ? (
          <div className="dot-grid" style={{ border: '1px dashed var(--line-ghost)', borderRadius: 2, padding: 16, fontSize: 12.5, color: 'var(--line-secondary)' }}>
            No pushes attempted yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentAttempts.map((a) => (
              <div key={a.id} style={{ border: '1px solid var(--line-ghost)', borderRadius: 2, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <OutcomePill outcome={a.outcome} />
                  <span style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.funnel.name}</span>
                </div>
                <span className="mono" style={{ fontSize: 10, color: 'var(--line-secondary)', flex: 'none' }}>
                  {a.stepsOk}/{a.stepsTotal} · {new Date(a.startedAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
