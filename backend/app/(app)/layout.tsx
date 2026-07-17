import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { SignOutButton } from '@/components/SignOutButton';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/signin');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          borderBottom: '1px solid var(--line-ghost)',
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Link
          href="/dashboard"
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: '0.12em',
            color: 'var(--line-secondary)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
          FUNNEL SETUPER
        </Link>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Link
            href="/settings"
            className="mono"
            style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}
          >
            Settings
          </Link>
          <SignOutButton />
        </nav>
      </header>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
