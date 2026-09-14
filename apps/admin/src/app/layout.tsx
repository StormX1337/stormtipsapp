import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/lib/providers';
import { AdminShell } from '@/components/shell';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'PROFIT TIPS Verwaltung', template: '%s · PROFIT TIPS Admin' },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="de" suppressHydrationWarning>
      <body>
        <Providers>
          <AdminShell>{children}</AdminShell>
        </Providers>
      </body>
    </html>
  );
}
