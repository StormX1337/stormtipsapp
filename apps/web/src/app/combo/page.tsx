'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import type { ComboDTO, Paginated } from '@storm-tips/types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/navigation';
import { ComboCard } from '@/components/combo-card';
import { Paywall, type PaywallData } from '@/components/paywall';
import { ErrorState, NoResults, OfflineBanner, ResponsibleGamblingNote } from '@/components/states';
import { Button, Skeleton } from '@/components/primitives';

/**
 * Combo screen.
 *
 * A subscriber sees the accumulators; everyone else sees the sales page, which
 * is the layout from the reference screenshot.
 */
export default function ComboPage(): ReactNode {
  const { t } = useI18n();
  const { has, loading } = useAuth();
  const [showSettled, setShowSettled] = useState(true);
  const unlocked = has('COMBO');

  const paywall = useQuery({
    queryKey: ['paywall', 'combo'],
    queryFn: () => api<PaywallData>('/billing/paywall/combo', { auth: true }),
    enabled: !unlocked,
  });

  const combos = useQuery({
    queryKey: ['combos', showSettled],
    queryFn: () =>
      api<Paginated<ComboDTO>>(`/tips/combo/groups?limit=20&includeSettled=${showSettled}`),
    enabled: unlocked,
  });

  return (
    <AppShell
      title={t('nav.combo')}
      left={
        unlocked ? (
          <Link
            href="/history?product=COMBO"
            aria-label={t('nav.history')}
            className="grid h-9 w-9 place-items-center rounded-md text-ink-muted hover:bg-bg-card hover:text-ink"
          >
            <History size={20} aria-hidden />
          </Link>
        ) : (
          <Link href="/account/subscription" className="text-[12px] text-ink-muted hover:text-ink">
            {t('paywall.restore')}
          </Link>
        )
      }
    >
      <div id="main" className="pt-3">
        <OfflineBanner />

        {loading ? (
          <div className="flex flex-col gap-3 pt-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : unlocked ? (
          <div className="flex flex-col gap-3 pb-6">
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant={showSettled ? 'outline' : 'ghost'}
                size="sm"
                onClick={() => setShowSettled((value) => !value)}
              >
                {showSettled ? t('common.all') : t('status.PENDING')}
              </Button>
            </div>

            {combos.isPending ? (
              Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-48 w-full" />
              ))
            ) : combos.isError ? (
              <ErrorState error={combos.error} onRetry={() => void combos.refetch()} />
            ) : combos.data.items.length === 0 ? (
              <NoResults />
            ) : (
              combos.data.items.map((combo) => <ComboCard key={combo.id} combo={combo} />)
            )}

            <ResponsibleGamblingNote />
          </div>
        ) : paywall.isPending ? (
          <div className="flex flex-col gap-3 pt-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : paywall.isError ? (
          <ErrorState error={paywall.error} onRetry={() => void paywall.refetch()} />
        ) : (
          /* Same measure as the standalone paywall route: a purchase decision
             reads better in a column than spread across the full page. */
          <div className="mx-auto w-full max-w-2xl">
            <Paywall data={paywall.data} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
