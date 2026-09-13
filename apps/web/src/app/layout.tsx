import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/lib/providers';
import { config } from '@/lib/config';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: `${config.appName} — Datenbasierte Sportanalysen`,
    template: `%s · ${config.appName}`,
  },
  description:
    'PROFIT TIPS veröffentlicht täglich Fußball- und Sportanalysen mit Quote, Wettmarkt und schriftlicher Begründung. Alle Statistiken beruhen auf geprüften, abgerechneten Ergebnissen.',
  applicationName: config.appName,
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    siteName: config.appName,
    title: `${config.appName} — Datenbasierte Sportanalysen`,
    description:
      'Tägliche Analysen mit geprüfter Erfolgsbilanz. 18+. Kein Ergebnis ist garantiert.',
  },
  other: { rating: 'adult' },
};

export const viewport: Viewport = {
  themeColor: '#0A0C10',
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
          Zum Inhalt springen
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
