import { NextResponse } from 'next/server';
import { logError, logWarn } from '@/lib/log';
import { prisma } from '@/lib/prisma';

// Best-effort sink for errors from the Chrome extension (background service
// worker, content script, side panel) — there's no browser-extension Sentry
// SDK worth the bundling complexity here, so the extension POSTs structured
// errors here instead and they land in the same Sentry project as everything
// else, tagged source=extension. The extension has no persisted session, so
// this accepts an optional apiKey (the same one used for POST /api/funnels)
// purely to attach a userId — a request with no key or an unrecognized one
// still gets logged, just without owner context.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.message !== 'string') {
    return NextResponse.json({ error: 'Expected { message: string, level?, context? }' }, { status: 400 });
  }

  const level: string = body.level === 'warn' ? 'warn' : 'error';
  const context: Record<string, unknown> = typeof body.context === 'object' && body.context ? body.context : {};

  const authHeader = request.headers.get('authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const user = match ? await prisma.user.findUnique({ where: { apiKey: match[1] } }) : null;

  const enrichedContext = { ...context, source: 'extension', userId: user?.id };
  if (level === 'warn') logWarn(String(body.message), enrichedContext);
  else logError(String(body.message), new Error(String(body.message)), enrichedContext);

  return NextResponse.json({ ok: true });
}
