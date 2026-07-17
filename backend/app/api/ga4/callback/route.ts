import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { exchangeGa4Code } from '@/lib/ga4/oauth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.redirect(new URL('/signin', base));
  const userId = (session.user as { id: string }).id;

  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  if (error) {
    return NextResponse.redirect(new URL(`/settings?ga4Error=${encodeURIComponent(error)}`, base));
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = cookies().get('ga4_oauth_state')?.value;
  cookies().delete('ga4_oauth_state');

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL('/settings?ga4Error=invalid_state', base));
  }

  let tokens;
  try {
    tokens = await exchangeGa4Code(code);
  } catch {
    return NextResponse.redirect(new URL('/settings?ga4Error=token_exchange_failed', base));
  }

  const existing = await prisma.ga4Connection.findUnique({ where: { userId } });
  if (!tokens.refresh_token && !existing) {
    return NextResponse.redirect(new URL('/settings?ga4Error=no_refresh_token', base));
  }

  await prisma.ga4Connection.upsert({
    where: { userId },
    create: {
      userId,
      refreshToken: tokens.refresh_token ?? '',
      accessToken: tokens.access_token ?? null,
      accessTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
    update: {
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      accessToken: tokens.access_token ?? null,
      accessTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
  });

  return NextResponse.redirect(new URL('/settings?ga4Connected=1', base));
}
