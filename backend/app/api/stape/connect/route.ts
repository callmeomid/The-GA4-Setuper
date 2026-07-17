import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Not an OAuth redirect — Stape auth is a pasted API key, so this is a plain
// save endpoint, not a /connect + /callback pair like GTM and GA4.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const body = await request.json().catch(() => ({}));
  const apiKey: string | undefined = body?.apiKey?.trim();
  if (!apiKey) return NextResponse.json({ error: 'apiKey is required' }, { status: 400 });

  await prisma.stapeConnection.upsert({
    where: { userId },
    create: { userId, apiKey },
    update: { apiKey },
  });

  return NextResponse.json({ ok: true });
}
