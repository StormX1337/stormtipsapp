'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Crown,
  Gift,
  LayoutList,
  Settings,
  Ticket,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';

interface TabDefinition {
  href: string;
  labelKey: 'nav.free' | 'nav.combo' | 'nav.extra' | 'nav.vip' | 'nav.poll';
  Icon: LucideIcon;
  activeClass: string;
}

/**
 * Bottom navigation.
 *
 * Five destinations, matching the reference app: Free, Combo, Extra, VIP, Poll.
 * Each tab carries its product's accent colour when active.
 */
const TABS: TabDefinition[] = [
  { href: '/free', labelKey: 'nav.free', Icon: LayoutList, activeClass: 'text-accent-500' },
  { href: '/combo', labelKey: 'nav.combo', Icon: Ticket, activeClass: 'text-gold-400' },
  { href: '/extra', labelKey: 'nav.extra', Icon: Zap, activeClass: 'text-cyan-500' },
  { href: '/vip', labelKey: 'nav.vip', Icon: Crown, activeClass: 'text-gold-300' },
  { href: '/poll', labelKey: 'nav.poll', Icon: BarChart3, activeClass: 'text-violet-400' },
];

export function BottomNav(): ReactNode {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line-subtle bg-bg-subtle/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map(({ href, labelKey, Icon, activeClass }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex h-[60px] flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors',
                  active ? activeClass : 'text-ink-dim hover:text-ink-muted',
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 1.9} aria-hidden />
                {t(labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Top bar: left glyph, centred title, right action cluster. */
export function AppHeader({
  title,
  left,
  right,
}: {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
}): ReactNode {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-20 border-b border-line-subtle bg-bg-base/92 backdrop-blur">
      <div className="mx-auto flex h-[52px] max-w-2xl items-center gap-2 px-[var(--page-gutter)]">
        <div className="flex w-16 items-center">{left}</div>
        <h1 className="flex-1 text-center text-[17px] font-bold tracking-tight">{title}</h1>
        <div className="flex w-16 items-center justify-end gap-1">
          {right ?? (
            <>
              <Link
                href="/account/referrals"
                aria-label="Freunde einladen"
                className="grid h-9 w-9 place-items-center rounded-md text-pink-500 hover:bg-bg-card"
              >
                <Gift size={20} aria-hidden />
              </Link>
              <Link
                href={user ? '/account' : '/auth/login'}
                aria-label="Einstellungen"
                className="grid h-9 w-9 place-items-center rounded-md text-ink-muted hover:bg-bg-card hover:text-ink"
              >
                <Settings size={20} aria-hidden />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/** Shared page shell: header, gutter, and room for the tab bar. */
export function AppShell({
  title,
  left,
  right,
  children,
}: {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="min-h-dvh bg-bg-base">
      <AppHeader title={title} left={left} right={right} />
      <main className="safe-bottom mx-auto max-w-2xl px-[var(--page-gutter)]">{children}</main>
      <BottomNav />
    </div>
  );
}
