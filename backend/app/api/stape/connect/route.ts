import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { listContainers } from '@/lib/stape/api';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const body = await request.json().catch(() => ({}));
  const apiKey: string = (body?.apiKey ?? '').trim();
  const region: string = body?.region === 'eu' ? 'eu' : 'global';
  if (!apiKey) return NextResponse.json({ error: 'apiKey is required' }, { status: 400 });

  // Verify the key actually works before saving it — same "fail loud, not
  // silently" principle as the GTM/GA4 connect flows, just without OAuth to
  // do that verification for us.
  try {
    await listContainers({ userId }, { apiKey, region });
  } catch (err) {
    const plainEnglish = (err as { plainEnglish?: string }).plainEnglish ?? (err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: plainEnglish }, { status: 400 });
  }

  await prisma.stapeConnection.upsert({
    where: { userId },
    create: { userId, apiKey, region },
    update: { apiKey, region },
  });

  return NextResponse.json({ ok: true });
}
