import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const SYSTEM_LABEL: Record<string, string> = { ga4: 'GA4', stape: 'Stape' };

export default async function IntegrationLogPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { system?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/signin');
  const userId = (session.user as { id: string }).id;

  const system = searchParams.system === 'stape' ? 'stape' : 'ga4';

  const funnel = await prisma.funnel.findUnique({ where: { id: params.id } });
  if (!funnel || funnel.ownerId !== userId) notFound();

  const logs = await prisma.integrationApiLog.findMany({
    where: { funnelId: params.id, system },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      <Link href={`/funnels/${params.id}`} className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
        &larr; Back to funnel
      </Link>
      <div style={{ display: 'flex', gap: 12, marginTop: 16, marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{SYSTEM_LABEL[system]} API call log</h1>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {(['ga4', 'stape'] as const).map((s) => (
            <Link
              key={s}
              href={`/funnels/${params.id}/integration-log?system=${s}`}
              className="mono"
              style={{
                fontSize: 10,
                textDecoration: 'none',
                padding: '3px 8px',
                borderRadius: 2,
                border: `1px solid ${s === system ? 'var(--accent)' : 'var(--line-ghost)'}`,
                color: s === system ? 'var(--accent)' : 'var(--line-secondary)',
              }}
            >
              {SYSTEM_LABEL[s]}
            </Link>
          ))}
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="dot-grid" style={{ border: '1px dashed var(--line-ghost)', borderRadius: 2, padding: 20, fontSize: 13, color: 'var(--line-secondary)' }}>
          No calls logged yet — open the {SYSTEM_LABEL[system]} setup screen to generate a preview, which already
          makes read calls against the API.
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
