import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getGa4AuthorizationUrl } from '@/lib/ga4/oauth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.redirect(new URL('/signin', process.env.NEXTAUTH_URL));

  const state = crypto.randomBytes(24).toString('hex');
  cookies().set('ga4_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  return NextResponse.redirect(getGa4AuthorizationUrl(state));
}
