import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getGtmAuthorizationUrl } from '@/lib/gtm/oauth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.redirect(new URL('/signin', process.env.NEXTAUTH_URL));

  const state = crypto.randomBytes(24).toString('hex');
  cookies().set('gtm_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  return NextResponse.redirect(getGtmAuthorizationUrl(state));
}
