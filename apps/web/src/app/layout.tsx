import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/lib/providers';
import { config } from '@/lib/config';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: `${config.appName} — Data-driven sports analysis`,
    template: `%s · ${config.appName}`,
  },
  description:
    'STORM TIPS publishes daily football and sports analyses with the price, the market and written reasoning. Every statistic is computed from verified, settled results.',
  applicationName: config.appName,
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    siteName: config.appName,
    title: `${config.appName} — Data-driven sports analysis`,
    description: 'Daily analyses with a verified track record. 18+. No result is guaranteed.',
  },
  other: { rating: 'adult' },
};

export const viewport: Viewport = {
  themeColor: '#070A12',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="de" suppressHydrationWarning>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-accent-500 focus:px-3 focus:py-2 focus:text-ink-inverse"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
