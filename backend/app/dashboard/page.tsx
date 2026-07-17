import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceIdForUser } from '@/lib/workspace';
import { SignOutButton } from '@/components/SignOutButton';
import { StatusBadge } from '@/components/StatusBadge';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/signin');
  const workspaceId = await requireWorkspaceIdForUser((session.user as { id: string }).id);

  const funnels = await prisma.funnel.findMany({
    where: { workspaceId },
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
            padding: '28px 20px',
            fontSize: 13,
            color: 'var(--line-secondary)',
            lineHeight: 1.6,
          }}
        >
          No funnels yet. Record one with the Chrome extension and it'll show up here.
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
