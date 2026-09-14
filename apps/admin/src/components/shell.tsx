'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Activity,
  BadgePercent,
  Bell,
  BarChart3,
  Building2,
  CalendarRange,
  CreditCard,
  Crown,
  FileText,
  Gauge,
  Globe2,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Plug,
  Radio,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Ticket,
  Trophy,
  Users,
  Vote,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@profit-tips/types';
import { useAdminAuth } from '@/lib/auth';
import { Skeleton } from './ui';

interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
  minRole?: UserRole;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

/** Sidebar structure — mirrors the operational areas of the product. */
const SECTIONS: NavSection[] = [
  {
    title: 'Übersicht',
    items: [
      { href: '/', label: 'Dashboard', Icon: LayoutDashboard },
      { href: '/statistics', label: 'Statistik', Icon: BarChart3 },
      { href: '/reports', label: 'Reports', Icon: FileText },
    ],
  },
  {
    title: 'Inhalte',
    items: [
      { href: '/tips', label: 'Tipps', Icon: ListChecks },
      { href: '/tips?product=VIP', label: 'VIP', Icon: Crown },
      { href: '/tips?product=EXTRA', label: 'Extra', Icon: Zap },
      { href: '/combos', label: 'Combo', Icon: Ticket },
      { href: '/tips?live=true', label: 'Live-Tipps', Icon: Radio },
      { href: '/polls', label: 'Umfragen', Icon: Vote },
    ],
  },
  {
    title: 'Katalog',
    items: [
      { href: '/catalogue/sports', label: 'Sportarten', Icon: Trophy, minRole: 'ADMIN' },
      { href: '/catalogue/leagues', label: 'Ligen', Icon: Globe2, minRole: 'ADMIN' },
      { href: '/catalogue/teams', label: 'Teams', Icon: Building2, minRole: 'ADMIN' },
      { href: '/catalogue/bookmakers', label: 'Buchmacher', Icon: BadgePercent, minRole: 'ADMIN' },
      { href: '/catalogue/events', label: 'Events & Quoten', Icon: CalendarRange, minRole: 'ADMIN' },
    ],
  },
  {
    title: 'Kommerz',
    items: [
      { href: '/commerce/plans', label: 'Tarife', Icon: CreditCard, minRole: 'ADMIN' },
      { href: '/commerce/fix-odds', label: 'FIX Odds', Icon: Target, minRole: 'ADMIN' },
      { href: '/commerce/coupons', label: 'Gutscheine', Icon: BadgePercent, minRole: 'ADMIN' },
      { href: '/commerce/promotions', label: 'Aktionen', Icon: Sparkles, minRole: 'ADMIN' },
      { href: '/commerce/subscriptions', label: 'Abos', Icon: ShieldCheck, minRole: 'ADMIN' },
      { href: '/commerce/payments', label: 'Zahlungen', Icon: CreditCard, minRole: 'ADMIN' },
    ],
  },
  {
    title: 'Nutzer',
    items: [{ href: '/users', label: 'Nutzer', Icon: Users }],
  },
  {
    title: 'System',
    items: [
      { href: '/notifications', label: 'Push-Mitteilungen', Icon: Bell, minRole: 'ADMIN' },
      { href: '/providers', label: 'API-Provider', Icon: Plug, minRole: 'SUPER_ADMIN' },
      { href: '/settings', label: 'Einstellungen', Icon: Settings, minRole: 'SUPER_ADMIN' },
      { href: '/logs', label: 'Audit-Log', Icon: Activity, minRole: 'ADMIN' },
    ],
  },
];

function LoginScreen(): ReactNode {
  const { login } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <div className="mb-6 text-center">
        <p className="text-[20px] font-black tracking-tight text-accent-500">PROFIT TIPS</p>
        <p className="text-[12px] text-ink-dim">Verwaltung</p>
      </div>
      <form
        className="card flex flex-col gap-3 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          setError(null);
          login(email, password)
            .catch((caught: Error) => setError(caught.message))
            .finally(() => setBusy(false));
        }}
      >
        {error ? (
          <p role="alert" className="rounded-sm bg-lost/15 px-3 py-2 text-[12px] text-lost">
            {error}
          </p>
        ) : null}
        <label className="block">
          <span className="label">E-Mail</span>
          <input
            className="input"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="label">Passwort</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="mt-1 rounded-sm bg-accent-500 px-4 py-2.5 text-[13px] font-bold text-ink-inverse disabled:opacity-50"
        >
          {busy ? 'Anmelden…' : 'Anmelden'}
        </button>
      </form>
      <p className="mt-6 text-center text-[11px] text-ink-dim">
        Zugriff nur für Moderatoren und Administratoren. Alle Aktionen werden protokolliert.
      </p>
    </main>
  );
}

export function AdminShell({ children }: { children: ReactNode }): ReactNode {
  const { user, loading, logout, can } = useAdminAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }
  if (!user) return <LoginScreen />;

  return (
    <div className="flex min-h-dvh">
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-60 shrink-0 overflow-y-auto border-r border-line-subtle bg-bg-subtle transition-transform lg:static lg:translate-x-0',
          menuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-2 px-4 py-4">
          <Gauge size={18} className="text-accent-500" aria-hidden />
          <span className="text-[14px] font-black tracking-tight">PROFIT TIPS</span>
        </div>

        <nav className="px-2 pb-6">
          {SECTIONS.map((section) => {
            const items = section.items.filter((item) => !item.minRole || can(item.minRole));
            if (items.length === 0) return null;
            return (
              <div key={section.title} className="mb-4">
                <p className="px-2 pb-1 text-[10px] font-bold tracking-wider text-ink-dim uppercase">
                  {section.title}
                </p>
                <ul>
                  {items.map((item) => {
                    const base = item.href.split('?')[0] ?? item.href;
                    const active =
                      pathname === base && (item.href.includes('?') ? false : pathname === base);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={clsx(
                            'flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-[12.5px] transition-colors',
                            active
                              ? 'bg-bg-card-alt font-semibold text-accent-500'
                              : 'text-ink-muted hover:bg-bg-card hover:text-ink',
                          )}
                        >
                          <item.Icon size={15} aria-hidden />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>

      {menuOpen ? (
        <button
          type="button"
          aria-label="Menü schließen"
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line-subtle bg-bg-base/95 px-4 py-2.5 backdrop-blur">
          <button
            type="button"
            aria-label="Menü"
            onClick={() => setMenuOpen((value) => !value)}
            className="grid h-8 w-8 place-items-center rounded-sm text-ink-muted hover:bg-bg-card lg:hidden"
          >
            <Menu size={18} aria-hidden />
          </button>
          <div className="flex-1" />
          <span className="text-[12px] text-ink-muted">
            {user.displayName ?? user.email}
            <span className="ml-2 rounded-sm bg-bg-card-alt px-1.5 py-0.5 text-[10px] font-bold text-accent-500">
              {user.role}
            </span>
          </span>
          <button
            type="button"
            onClick={() => void logout().then(() => router.refresh())}
            aria-label="Abmelden"
            className="grid h-8 w-8 place-items-center rounded-sm text-ink-muted hover:bg-bg-card hover:text-ink"
          >
            <LogOut size={16} aria-hidden />
          </button>
        </header>

        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
