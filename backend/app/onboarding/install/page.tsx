import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';

export default async function InstallExtensionPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/signin');

  const extensionUrl = process.env.NEXT_PUBLIC_EXTENSION_URL || '';

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px' }}>
      <Link href="/dashboard" className="mono" style={{ fontSize: 11, color: 'var(--line-secondary)', textDecoration: 'none' }}>
        &larr; Dashboard
      </Link>

      <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.1em', color: 'var(--line-secondary)', textTransform: 'uppercase', marginTop: 20, marginBottom: 8 }}>
        Step 1 · Install
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
        Install the Funnel Setuper extension
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--line-secondary)', lineHeight: 1.65, maxWidth: '58ch', margin: '0 0 20px' }}>
        This is what records your funnel — every click, page view, and form submit — from inside your own browser.
        It never touches your site&rsquo;s backend, and nothing reaches GTM or GA4 until you explicitly approve it
        later.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, margin: '0 0 22px' }}>
        {[
          extensionUrl ? 'Add it to Chrome using the button below' : 'Get the extension from wherever your team is distributing it',
          'Pin it to your toolbar so it&rsquo;s one click away',
        ].map((item) => (
          <div key={item} className="mono" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--line-secondary)' }}>
            <span style={{ width: 14, height: 14, border: '1px solid var(--line-ghost)', borderRadius: 2, flex: '0 0 auto' }} />
            <span dangerouslySetInnerHTML={{ __html: item }} />
          </div>
        ))}
      </div>

      <details style={{ marginBottom: 22 }}>
        <summary className="mono" style={{ fontSize: 10.5, color: 'var(--line-secondary)', cursor: 'pointer' }}>
          ▸ Why does this need to be an extension, not just a script on my site?
        </summary>
        <p style={{ fontSize: 12.5, color: 'var(--line-secondary)', lineHeight: 1.6, margin: '8px 0 0', paddingLeft: 12, borderLeft: '1px solid var(--line-ghost)' }}>
          It has to see the page the way you see it — clicks, URLs, form fields — without you pasting any code into
          your site first. That&rsquo;s also why it&rsquo;s the safest possible starting point: it captures locally,
          and you choose what leaves your browser.
        </p>
      </details>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {extensionUrl && (
          <a href={extensionUrl} target="_blank" rel="noreferrer" className="btn" style={{ textDecoration: 'none' }}>
            Get the extension →
          </a>
        )}
        <Link href="/onboarding/record" className="btn btn-accent" style={{ textDecoration: 'none' }}>
          I&rsquo;ve installed it — continue
        </Link>
      </div>
    </main>
  );
}
