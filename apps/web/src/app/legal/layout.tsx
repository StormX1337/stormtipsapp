import Link from 'next/link';
import type { ReactNode } from 'react';
import { config } from '@/lib/config';

const LINKS = [
  { href: '/legal/terms', label: 'AGB' },
  { href: '/legal/privacy', label: 'Datenschutz' },
  { href: '/legal/responsible-gambling', label: 'Verantwortungsvolles Spielen' },
  { href: '/legal/disclaimer', label: 'Haftungsausschluss' },
  { href: '/legal/help', label: 'Hilfe & Support' },
];

export default function LegalLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="min-h-dvh bg-bg-base">
      <header className="border-b border-line-subtle">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-5 py-4">
          <Link href="/free" className="text-[17px] font-black tracking-tight text-accent-500">
            {config.appName}
          </Link>
          <nav className="no-scrollbar -mx-1 flex flex-1 gap-3 overflow-x-auto px-1 text-[12px]">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="shrink-0 whitespace-nowrap text-ink-muted hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto max-w-3xl px-5 py-8 [&_h2]:mt-8 [&_h2]:text-[16px] [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:text-[14px] [&_h3]:font-bold [&_li]:mb-1.5 [&_p]:mt-3 [&_p]:text-[13.5px] [&_p]:leading-relaxed [&_p]:text-ink-muted [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-[13.5px] [&_ul]:text-ink-muted"
      >
        {children}
        <p className="mt-10 border-t border-line-subtle pt-6 text-[11px] text-ink-dim">
          Diese Seite dient der Information und ersetzt keine Rechtsberatung. Betreiberangaben,
          Gerichtsstand und Aufsichtsbehörde sind vor dem Produktivbetrieb durch die tatsächlichen
          Unternehmensdaten zu ersetzen.
        </p>
      </main>
    </div>
  );
}
