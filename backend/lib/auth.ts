import { PrismaAdapter } from '@auth/prisma-adapter';
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from './prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // Database sessions (not JWT) so they're revocable and can be seeded directly
  // in Prisma for local testing without going through the Google OAuth redirect.
  session: { strategy: 'database' },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  pages: {
    signIn: '/signin',
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) (session.user as { id: string }).id = user.id;
      return session;
    },
  },
});
