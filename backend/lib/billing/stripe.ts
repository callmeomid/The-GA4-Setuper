import Stripe from 'stripe';

const globalForStripe = globalThis as unknown as { stripe?: Stripe };

// Single client instance across hot reloads, same pattern as lib/prisma.ts.
export const stripe =
  globalForStripe.stripe ??
  new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
    apiVersion: '2025-02-24.acacia',
  });

if (process.env.NODE_ENV !== 'production') globalForStripe.stripe = stripe;

export function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return new URL(path, base).toString();
}
