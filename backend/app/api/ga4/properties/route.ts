import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { listProperties, listWebDataStreams } from '@/lib/ga4/api';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const connection = await prisma.ga4Connection.findUnique({ where: { userId } });
  if (!connection) return NextResponse.json({ error: 'Not connected to Google Analytics' }, { status: 400 });

  const propertyId = new URL(request.url).searchParams.get('propertyId');

  try {
    if (propertyId) {
      const streams = await listWebDataStreams(connection.refreshToken, propertyId);
      return NextResponse.json({ streams });
    }
    const properties = await listProperties(connection.refreshToken);
    return NextResponse.json({ properties });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const plainEnglish = (err as { plainEnglish?: string }).plainEnglish ?? message;
    return NextResponse.json({ error: plainEnglish }, { status: 502 });
  }
}
