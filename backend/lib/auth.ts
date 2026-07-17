import { PrismaAdapter } from '@next-auth/prisma-adapter';
import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from './prisma';
import { getOrCreateWorkspaceForUser } from './workspace';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  // Database sessions (not JWT) so they're revocable and can be seeded directly
  // in Prisma for local testing without going through the Google OAuth redirect.
  session: { strategy: 'database' },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  pages: {
    signIn: '/signin',
  },
  events: {
    // Fires once, right after the adapter inserts a brand-new User row —
    // the natural place to provision their personal workspace (and its
    // encryption key) before they can reach any workspace-scoped route.
    async createUser({ user }) {
      await getOrCreateWorkspaceForUser(user.id);
    },
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) (session.user as { id: string }).id = user.id;
      return session;
    },
  },
};
