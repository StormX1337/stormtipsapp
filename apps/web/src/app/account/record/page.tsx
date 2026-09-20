'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { StatisticsDTO, StatsWindow, TipDTO } from '@storm-tips/types';
import { colors } from '@storm-tips/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/navigation';
import { ErrorState } from '@/components/states';
import { Button, Skeleton } from '@/components/primitives';
import { StatTile } from '@/components/stat-tiles';
import { TipCard } from '@/components/tip-card';
import { usePrefersReducedMotion } from '@/lib/use-reveal';

const WINDOWS: StatsWindow[] = ['D7', 'D30', 'D90', 'M6', 'M12', 'ALL'];

interface FollowedTip {
  stake: number;
  followedAt: string;
  tip: TipDTO;
}

/**
 * The reader's own record.
 *
 * Deliberately the same figures in the same order as the published statistics
 * page, because the only interesting thing to do with this number is compare it
 * with that one. What differs is the source: only tracked analyses, each
 * settled with the stake the reader entered rather than the published flat one.
 */
export default function MyRecordPage(): ReactNode {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [window_, setWindow] = useState<StatsWindow>('D30');
  const stillCharts = usePrefersReducedMotion();

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login?next=/account/record');
  }, [loading, user, router]);

  const record = useQuery({
    queryKey: ['record', window_],
    queryFn: () => api<StatisticsDTO>(`/me/record?window=${window_}`),
    enabled: Boolean(user),
  });
  const tracked = useQuery({
    queryKey: ['record', 'tips'],
    queryFn: () => api<{ items: FollowedTip[] }>('/me/follows/tips?limit=20'),
    enabled: Boolean(user),
  });

  const stats = record.data;
  const numberFormat = new Intl.NumberFormat('en-GB');

  return (
    <AppShell title={t('record.title')}>
      <div id="main" className="flex flex-col gap-3 py-4">
        <p className="text-[12.5px] text-ink-muted">{t('record.intro')}</p>

        <div className="no-scrollbar -mx-[var(--page-gutter)] flex gap-1.5 overflow-x-auto px-[var(--page-gutter)] md:mx-0 md:px-0">
          {WINDOWS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setWindow(key)}
              className={clsx(
                'press shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors',
                window_ === key
                  ? 'bg-bg-card-alt text-ink'
                  : 'text-ink-muted hover:bg-bg-card hover:text-ink',
              )}
            >
              {t(`stats.window.${key}` as never)}
            </button>
          ))}
        </div>

        {record.isPending || loading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-[68px]" />
            ))}
          </div>
        ) : record.isError ? (
          <ErrorState error={record.error} onRetry={() => void record.refetch()} />
        ) : stats && stats.settledTips === 0 ? (
          /*
           * Two different nothings. A reader who has tracked three matches that
           * kick off tonight has not "tracked nothing" — telling them so reads
           * as if the button had failed.
           */
          <section className="card flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="max-w-sm text-[13px] text-ink-muted">
              {stats.pendingTips > 0
                ? t('record.waiting', { count: stats.pendingTips })
                : t('record.empty')}
            </p>
            {stats.pendingTips === 0 ? (
              <Link href="/free">
                <Button size="sm">{t('record.browse')}</Button>
              </Link>
            ) : null}
          </section>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile
                label={t('record.tracked')}
                value={numberFormat.format(stats.settledTips)}
                hint={
                  stats.pendingTips > 0
                    ? `${t('record.openTips')}: ${stats.pendingTips}`
                    : undefined
                }
              />
              <StatTile label={t('stats.winRate')} value={`${stats.winRate.toFixed(1)}%`} />
              <StatTile
                label={t('stats.roi')}
                value={`${stats.roi > 0 ? '+' : ''}${stats.roi.toFixed(2)}%`}
                tone={stats.roi >= 0 ? 'positive' : 'negative'}
              />
              <StatTile
                label={t('stats.profit')}
                value={`${stats.profit > 0 ? '+' : ''}${stats.profit.toFixed(2)}`}
                tone={stats.profit >= 0 ? 'positive' : 'negative'}
              />
            </div>

            {stats.byDay.length > 1 ? (
              <section className="card p-3">
                <h2 className="mb-2 text-[13px] font-bold">{t('stats.cumulativeProfit')}</h2>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={stats.byDay}
                      margin={{ top: 4, right: 4, left: -18, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="recordGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={colors.accent[500]} stopOpacity={0.5} />
                          <stop offset="100%" stopColor={colors.accent[500]} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={colors.border.subtle} vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: colors.text.muted, fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={28}
                      />
                      <YAxis
                        tick={{ fill: colors.text.muted, fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        width={44}
                      />
                      <Tooltip
                        contentStyle={{
                          background: colors.bg.raised,
                          border: `1px solid ${colors.border.default}`,
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: colors.text.secondary }}
                      />
                      <Area
                        isAnimationActive={!stillCharts}
                        type="monotone"
                        dataKey="cumulativeProfit"
                        name={t('stats.cumulativeProfit')}
                        stroke={colors.accent[500]}
                        strokeWidth={2}
                        fill="url(#recordGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        {tracked.data && tracked.data.items.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h2 className="px-1 pt-2 text-[13px] font-semibold text-ink-muted">
              {t('record.tracked')}
            </h2>
            {tracked.data.items.map((item) => (
              <div key={item.tip.id} className="flex flex-col">
                <TipCard tip={item.tip} href={`/tips/${item.tip.id}`} />
                {/* An annotation on the card above, not a label of its own. */}
                <p className="tabular px-2 pt-1 text-right text-[11px] text-ink-dim">
                  {t('record.stake')}: {item.stake.toFixed(2)}
                </p>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
