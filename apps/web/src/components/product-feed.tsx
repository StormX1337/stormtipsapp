'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Lock, Volleyball } from 'lucide-react';
import type { ProductCode, PromotionDTO, TipFeedDTO } from '@storm-tips/types';
import { toDateKey } from '@storm-tips/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { AppShell } from './navigation';
import { DateStrip } from './date-strip';
import { PromoBanner } from './promo-banner';
import { TipCardSkeleton, TipGroup } from './tip-card';
import { ErrorState, NoResults, OfflineBanner, ResponsibleGamblingNote } from './states';
import { Button } from './primitives';

const PATH_BY_PRODUCT: Record<ProductCode, string> = {
  FREE: 'free',
  VIP: 'vip',
  EXTRA: 'extra',
  COMBO: 'combo',
  FIX_ODDS: 'fix-odds',
};

/**
 * The product feed screen.
 *
 * One component drives Free, VIP, Extra and Fix Odds: the only differences are
 * the product code and, for premium products, the paywall shown above locked
 * content.
 */
export function ProductFeed({
  product,
  title,
}: {
  product: ProductCode;
  title: string;
}): ReactNode {
  const { t } = useI18n();
  const { has, loading: authLoading } = useAuth();
  const [date, setDate] = useState(() => toDateKey(new Date()));

  const unlocked = has(product);
  const path = PATH_BY_PRODUCT[product];

  const feed = useQuery({
    queryKey: ['feed', product, date, unlocked],
    queryFn: () => api<TipFeedDTO>(`/tips/${path}?date=${date}`, { auth: true }),
    /**
     * Scores and minutes move while a match is on, and the feed used to fetch
     * once and then sit there — so a fixture stayed 0-0 until the reader
     * reloaded. Polling only while something is actually in play keeps a day of
     * finished fixtures from re-fetching for nothing.
     */
    refetchInterval: (query) =>
      query.state.data?.groups.some((group) =>
        group.tips.some((tip) => tip.event.status === 'LIVE' || tip.event.status === 'HALFTIME'),
      )
        ? 30_000
        : false,
  });

  const promotions = useQuery({
    queryKey: ['promotions', unlocked],
    queryFn: () => api<{ items: PromotionDTO[] }>('/billing/promotions', { auth: true }),
    staleTime: 5 * 60_000,
  });

  // Re-fetch when the tab regains focus after being hidden for a while.
  useEffect(() => {
    const handler = (): void => {
      if (document.visibilityState === 'visible') void feed.refetch();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [feed]);

  const banner = promotions.data?.items[0];

  return (
    <AppShell
      title={title}
      left={
        <Link
          href="/live"
          aria-label={t('live.title')}
          className="grid h-9 w-9 place-items-center rounded-md text-ink-muted hover:bg-bg-card hover:text-ink"
        >
          <Volleyball size={20} aria-hidden />
        </Link>
      }
    >
      <div className="flex flex-col gap-3 pt-3">
        <OfflineBanner />
        {banner ? <PromoBanner promotion={banner} /> : null}
      </div>

      <div className="sticky top-[52px] z-10 -mx-[var(--page-gutter)] bg-bg-base/95 px-[var(--page-gutter)] backdrop-blur md:top-[60px] md:-mx-6 md:px-6">
        <DateStrip value={date} onChange={setDate} />
      </div>

      <div id="main" className="pt-1 pb-6">
        {!unlocked && !authLoading && product !== 'FREE' ? (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-gold-400/40 bg-gold-400/10 p-3">
            <Lock size={18} className="shrink-0 text-gold-300" aria-hidden />
            <p className="flex-1 text-[12.5px] text-gold-100">
              {t('feed.lockedBody', { product: t(`product.${product}` as never) })}
            </p>
            <Link href={`/paywall/${path}`}>
              <Button variant="gold" size="sm">
                {t(
                  product === 'VIP'
                    ? 'paywall.getVip'
                    : product === 'EXTRA'
                      ? 'paywall.getExtra'
                      : product === 'COMBO'
                        ? 'paywall.getCombo'
                        : 'paywall.getFixOdds',
                )}
              </Button>
            </Link>
          </div>
        ) : null}

        {feed.isPending ? (
          <div className="mt-4 flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-x-5">
            {Array.from({ length: 6 }, (_, index) => (
              <TipCardSkeleton key={index} />
            ))}
          </div>
        ) : feed.isError ? (
          <div className="mt-4">
            <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />
          </div>
        ) : feed.data.groups.length === 0 ? (
          <div className="mt-4">
            <NoResults />
          </div>
        ) : (
          <div className="flex flex-col lg:block lg:columns-2 lg:gap-x-5">
            {feed.data.groups.map((group, index) => (
              <TipGroup key={group.league.id} group={group} index={index} />
            ))}
          </div>
        )}

        <ResponsibleGamblingNote />
      </div>
    </AppShell>
  );
}
