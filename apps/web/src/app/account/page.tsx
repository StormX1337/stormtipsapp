'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  BookmarkCheck,
  ChevronRight,
  CreditCard,
  Gift,
  LogOut,
  ShieldQuestion,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api';
import { AppShell } from '@/components/navigation';
import { Button, Skeleton } from '@/components/primitives';

function Item({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  value?: string;
}): ReactNode {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-bg-card-alt"
    >
      <span className="text-ink-dim">{icon}</span>
      <span className="flex-1 text-[13.5px]">{label}</span>
      {value ? <span className="text-[12px] text-ink-dim">{value}</span> : null}
      <ChevronRight size={16} className="text-ink-dim" aria-hidden />
    </Link>
  );
}

export default function AccountPage(): ReactNode {
  const { t } = useI18n();
  const { user, loading, logout, products } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login?next=/account');
  }, [loading, user, router]);

  async function deleteAccount(): Promise<void> {
    if (!window.confirm('Delete this account? This cannot be undone.')) return;
    await api('/me', { method: 'DELETE' });
    await logout();
    router.replace('/free');
  }

  return (
    <AppShell measure="narrow" title={t('profile.title')}>
      <div id="main" className="flex flex-col gap-4 py-4">
        {loading || !user ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <>
            <section className="card flex items-center gap-3 p-4">
              <span
                aria-hidden
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent-500 text-[17px] font-black text-ink-inverse"
              >
                {(user.displayName ?? user.email)[0]?.toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold">{user.displayName ?? user.email}</p>
                <p className="truncate text-[12px] text-ink-dim">{user.email}</p>
                {!user.emailVerified ? (
                  <p className="mt-1 text-[11px] text-gold-400">{t('auth.verifyEmail')}</p>
                ) : null}
              </div>
            </section>

            <section className="card overflow-hidden">
              <div className="flex flex-wrap gap-1.5 border-b border-line-subtle px-3 py-3">
                {[...products].map((product) => (
                  <span
                    key={product}
                    className="rounded-full border border-line px-2 py-0.5 text-[11px] font-bold text-ink-muted"
                  >
                    {t(`product.${product}` as never)}
                  </span>
                ))}
              </div>
              <div className="divide-y divide-line-subtle">
                <Item
                  href="/account/record"
                  icon={<BookmarkCheck size={18} aria-hidden />}
                  label={t('record.title')}
                />
                <Item
                  href="/account/subscription"
                  icon={<CreditCard size={18} aria-hidden />}
                  label={t('subscription.title')}
                />
                <Item
                  href="/account/notifications"
                  icon={<Bell size={18} aria-hidden />}
                  label={t('profile.notifications')}
                />
                <Item
                  href="/account/referrals"
                  icon={<Gift size={18} aria-hidden />}
                  label={t('referral.title')}
                  value={user.referralCode}
                />
              </div>
            </section>

            <section className="card overflow-hidden">
              <div className="divide-y divide-line-subtle">
                <Item
                  href="/legal/responsible-gambling"
                  icon={<ShieldQuestion size={18} aria-hidden />}
                  label={t('legal.responsible')}
                />
                <Item
                  href="/legal/terms"
                  icon={<span aria-hidden>§</span>}
                  label={t('legal.terms')}
                />
                <Item
                  href="/legal/privacy"
                  icon={<span aria-hidden>◎</span>}
                  label={t('legal.privacy')}
                />
                <Item
                  href="/legal/help"
                  icon={<span aria-hidden>?</span>}
                  label={t('legal.help')}
                />
              </div>
            </section>

            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="lg"
                onClick={() => void logout().then(() => router.push('/free'))}
              >
                <LogOut size={16} aria-hidden /> {t('auth.logout')}
              </Button>
              <Button variant="danger" size="lg" onClick={() => void deleteAccount()}>
                <Trash2 size={16} aria-hidden /> {t('profile.deleteAccount')}
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
