import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { encryptWorkspaceSecret } from '@/lib/crypto/tokenVault';
import { exchangeGtmCode } from '@/lib/gtm/oauth';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceIdForUser } from '@/lib/workspace';

export async function GET(request: Request) {
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.redirect(new URL('/signin', base));
  const userId = (session.user as { id: string }).id;
  const workspaceId = await requireWorkspaceIdForUser(userId);

  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  if (error) {
    return NextResponse.redirect(new URL(`/settings?gtmError=${encodeURIComponent(error)}`, base));
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = cookies().get('gtm_oauth_state')?.value;
  cookies().delete('gtm_oauth_state');

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL('/settings?gtmError=invalid_state', base));
  }

  let tokens;
  try {
    tokens = await exchangeGtmCode(code);
  } catch {
    return NextResponse.redirect(new URL('/settings?gtmError=token_exchange_failed', base));
  }

  const existing = await prisma.gtmConnection.findUnique({ where: { workspaceId } });
  if (!tokens.refresh_token && !existing) {
    // Google only omits refresh_token on repeat consent without prompt=consent;
    // we always pass prompt=consent, so this means something unexpected happened.
    return NextResponse.redirect(new URL('/settings?gtmError=no_refresh_token', base));
  }

  const accessTokenEnc = tokens.access_token
    ? await encryptWorkspaceSecret(workspaceId, 'gtmAccessToken', tokens.access_token)
    : null;

  await prisma.gtmConnection.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      refreshTokenEnc: await encryptWorkspaceSecret(workspaceId, 'gtmRefreshToken', tokens.refresh_token ?? ''),
      accessTokenEnc,
      accessTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
    update: {
      ...(tokens.refresh_token
        ? { refreshTokenEnc: await encryptWorkspaceSecret(workspaceId, 'gtmRefreshToken', tokens.refresh_token) }
        : {}),
      accessTokenEnc,
      accessTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
  });

  return NextResponse.redirect(new URL('/settings?gtmConnected=1', base));
}
