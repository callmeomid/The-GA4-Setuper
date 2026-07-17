import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function GtmLogPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/signin');
  const userId = (session.user as { id: string }).id;

  const funnel = await prisma.funnel.findUnique({ where: { id: params.id } });
  if (!funnel || funnel.ownerId !== userId) notFound();

  const logs = await prisma.gtmApiLog.findMany({
    where: { funnelId: params.id },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      <Link href={`/funnels/${params.id}`} className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
        &larr; Back to funnel
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginTop: 16, marginBottom: 16 }}>GTM API call log</h1>

      {logs.length === 0 ? (
        <div className="dot-grid" style={{ border: '1px dashed var(--line-ghost)', borderRadius: 2, padding: 20, fontSize: 13, color: 'var(--line-secondary)' }}>
          No calls logged yet — open "Set up in Google Tag Manager" to generate a preview, which already makes read
          calls against the GTM API.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {logs.map((log) => (
            <details key={log.id} style={{ border: `1px solid ${log.errorMessage ? 'var(--danger)' : 'var(--line-ghost)'}`, borderRadius: 2, padding: 10 }}>
              <summary className="mono" style={{ fontSize: 11, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  {log.method} {log.endpoint}
                </span>
                <span style={{ color: log.errorMessage ? 'var(--danger)' : 'var(--line-secondary)' }}>
                  {log.responseStatus ?? '—'} · {log.durationMs}ms · {new Date(log.createdAt).toLocaleTimeString()}
                </span>
              </summary>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="mono" style={{ fontSize: 10, color: 'var(--line-secondary)' }}>REQUEST</div>
                <pre className="mono" style={{ fontSize: 10, color: 'var(--line-secondary)', overflow: 'auto', margin: 0 }}>{log.requestBody}</pre>
                {log.errorMessage ? (
                  <>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--danger)' }}>ERROR</div>
                    <pre className="mono" style={{ fontSize: 10, color: 'var(--danger)', overflow: 'auto', margin: 0 }}>{log.errorMessage}</pre>
                  </>
                ) : (
                  <>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--line-secondary)' }}>RESPONSE</div>
                    <pre className="mono" style={{ fontSize: 10, color: 'var(--line-secondary)', overflow: 'auto', margin: 0 }}>{log.responseBody}</pre>
                  </>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </main>
  );
}
