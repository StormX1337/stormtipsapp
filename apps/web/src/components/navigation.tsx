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
 * The five destinations, shown as a bottom tab bar on a phone and as a row in
 * the header on anything wider. Each carries its product's accent when active.
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
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line-subtle bg-bg-subtle/95 backdrop-blur md:hidden"
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

/** Invite and account, shared by the phone and desktop headers. */
function HeaderActions(): ReactNode {
  const { user } = useAuth();
  return (
    <>
      <Link
        href="/account/referrals"
        aria-label="Invite friends"
        className="grid h-9 w-9 place-items-center rounded-md text-pink-500 transition-colors hover:bg-bg-card"
      >
        <Gift size={20} aria-hidden />
      </Link>
      <Link
        href={user ? '/account' : '/auth/login'}
        aria-label="Account"
        className="grid h-9 w-9 place-items-center rounded-md text-ink-muted transition-colors hover:bg-bg-card hover:text-ink"
      >
        <Settings size={20} aria-hidden />
      </Link>
    </>
  );
}

/**
 * The desktop header.
 *
 * A phone layout centred in a desktop window leaves most of the screen empty
 * and puts the navigation as far from the pointer as it can get. From `md` up
 * the tabs move into the header, where a mouse expects them, and the tab bar
 * at the bottom goes away.
 */
function DesktopNav(): ReactNode {
  const pathname = usePathname();
  const t = useT();

  return (
    <header className="sticky top-0 z-20 hidden border-b border-line-subtle bg-bg-base/92 backdrop-blur md:block">
      <div className="mx-auto flex h-[60px] max-w-6xl items-center gap-6 px-6">
        <Link href="/free" className="text-[17px] font-black tracking-tight text-accent-500">
          STORM TIPS
        </Link>
        <nav aria-label="Main navigation" className="flex flex-1 items-center gap-1">
          {TABS.map(({ href, labelKey, Icon, activeClass }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-semibold transition-colors',
                  active
                    ? `${activeClass} bg-bg-card`
                    : 'text-ink-dim hover:bg-bg-card hover:text-ink',
                )}
              >
                <Icon size={16} strokeWidth={active ? 2.4 : 1.9} aria-hidden />
                {t(labelKey)}
              </Link>
            );
          })}
          {/* Live and Statistics do not fit five phone tabs, but there is room
              for them here, and both were otherwise unreachable without a URL. */}
          {(['/live', '/statistics'] as const).map((href) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname.startsWith(href) ? 'page' : undefined}
              className={clsx(
                'flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-semibold transition-colors',
                pathname.startsWith(href)
                  ? 'bg-bg-card text-ink'
                  : 'text-ink-dim hover:bg-bg-card hover:text-ink',
              )}
            >
              {t(href === '/live' ? 'nav.live' : 'nav.statistics')}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <HeaderActions />
        </div>
      </div>
    </header>
  );
}

/** Phone top bar: left glyph, centred title, right action cluster. */
export function AppHeader({
  title,
  left,
  right,
}: {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
}): ReactNode {
  return (
    <header className="sticky top-0 z-20 border-b border-line-subtle bg-bg-base/92 backdrop-blur md:hidden">
      <div className="mx-auto flex h-[52px] max-w-2xl items-center gap-2 px-[var(--page-gutter)]">
        <div className="flex w-16 items-center">{left}</div>
        <h1 className="flex-1 text-center text-[17px] font-bold tracking-tight">{title}</h1>
        <div className="flex w-16 items-center justify-end gap-1">{right ?? <HeaderActions />}</div>
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
      <DesktopNav />
      <AppHeader title={title} left={left} right={right} />
      {/*
        The column stays phone-width on a phone and widens from `md`, where the
        header carries the navigation and the page has room to use.
      */}
      <main className="safe-bottom mx-auto max-w-2xl px-[var(--page-gutter)] md:max-w-6xl md:px-6">
        {/* The phone header carries its own <h1>, so this one only exists where
            that header is hidden — one per document at every width. */}
        <h1 className="hidden pt-6 pb-1 text-[24px] font-extrabold tracking-tight md:block">
          {title}
        </h1>
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
