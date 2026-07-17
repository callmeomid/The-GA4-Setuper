import Link from 'next/link';
import { headers } from 'next/headers';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { WaitForFunnel } from '@/components/WaitForFunnel';

export default async function RecordFunnelPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/signin');
  const userId = (session.user as { id: string }).id;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { apiKey: true } });
  const initialCount = await prisma.funnel.count({ where: { ownerId: userId } });

  const headerList = headers();
  const host = headerList.get('host') ?? 'localhost:3000';
  const proto = headerList.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const backendUrl = `${proto}://${host}/api/funnels`;

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px' }}>
      <Link href="/onboarding/install" className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
        &larr; Back
      </Link>

      <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.1em', color: 'var(--line-secondary)', textTransform: 'uppercase', marginTop: 20, marginBottom: 8 }}>
        Step 2 · Record
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
        Open your site and hit record
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--line-secondary)', lineHeight: 1.65, maxWidth: '58ch', margin: '0 0 20px' }}>
        Click the extension icon, paste the two values below into its <strong style={{ color: 'var(--line-primary)' }}>Send to backend</strong> fields,
        then hit Start Recording and click through your funnel exactly like a customer would — land on a page, click
        a button, submit a form. We only capture the URL, the trigger type, and form field <em>names</em>, never
        values.
      </p>

      <WaitForFunnel backendUrl={backendUrl} apiKey={user?.apiKey ?? ''} initialCount={initialCount} />

      <details style={{ marginTop: 20 }}>
        <summary className="mono" style={{ fontSize: 10.5, color: 'var(--line-secondary)', cursor: 'pointer' }}>
          ▸ What exactly counts as a &quot;step&quot;?
        </summary>
        <p style={{ fontSize: 12.5, color: 'var(--line-secondary)', lineHeight: 1.6, margin: '8px 0 0', paddingLeft: 12, borderLeft: '1px solid var(--line-ghost)' }}>
          A page view, a click on something meaningful (a button, a link), or a form submit. Scrolling and mouse
          movement are never recorded.
        </p>
      </details>
    </main>
  );
}
