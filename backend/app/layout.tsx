import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Funnel Setuper',
  description: 'Review your captured funnel before setup.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
