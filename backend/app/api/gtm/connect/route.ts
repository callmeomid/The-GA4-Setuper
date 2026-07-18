import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getGtmAuthorizationUrl } from '@/lib/gtm/oauth';

export async function GET() {
  const session = await auth();
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
