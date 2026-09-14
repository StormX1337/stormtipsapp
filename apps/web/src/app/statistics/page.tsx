'use client';

import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ProductCode, StatisticsDTO, StatsWindow } from '@profit-tips/types';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/navigation';
import { StatTile } from '@/components/stat-tiles';
import { ErrorState, OfflineBanner, ResponsibleGamblingNote } from '@/components/states';
import { Skeleton } from '@/components/primitives';

const WINDOWS: StatsWindow[] = ['D7', 'D30', 'D90', 'M6', 'M12', 'ALL'];
const PRODUCTS: (ProductCode | 'ALL')[] = ['ALL', 'FREE', 'VIP', 'EXTRA', 'COMBO', 'FIX_ODDS'];

export default function StatisticsPage(): ReactNode {
  const { t, locale } = useI18n();
  const [window, setWindow] = useState<StatsWindow>('D30');
  const [product, setProduct] = useState<ProductCode | 'ALL'>('ALL');

  const stats = useQuery({
    queryKey: ['statistics', product, window],
    queryFn: () =>
      api<StatisticsDTO>(`/statistics?product=${product}&window=${window}`, { auth: false }),
  });

  const numberFormat = new Intl.NumberFormat(locale === 'de' ? 'de-DE' : 'en-GB');

  return (
    <AppShell title={t('stats.title')}>
      <div id="main" className="flex flex-col gap-4 py-4">
        <OfflineBanner />

        <div className="no-scrollbar -mx-[var(--page-gutter)] flex gap-2 overflow-x-auto px-[var(--page-gutter)]">
          {PRODUCTS.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setProduct(code)}
              aria-pressed={product === code}
              className={clsx(
                'shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors',
                product === code
                  ? 'border-accent-500 bg-accent-500/10 text-accent-500'
                  : 'border-line-subtle text-ink-muted hover:border-line-strong',
              )}
            >
              {code === 'ALL' ? t('common.all') : t(`product.${code}` as never)}
            </button>
          ))}
        </div>

        <div className="no-scrollbar -mx-[var(--page-gutter)] flex gap-2 overflow-x-auto px-[var(--page-gutter)]">
          {WINDOWS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setWindow(key)}
              aria-pressed={window === key}
              className={clsx(
                'shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors',
                window === key ? 'bg-bg-card-alt text-ink' : 'text-ink-dim hover:text-ink-muted',
              )}
            >
              {t(`stats.window.${key}` as never)}
            </button>
          ))}
        </div>

        {stats.isPending ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-[68px]" />
            ))}
          </div>
        ) : stats.isError ? (
          <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
        ) : stats.data.settledTips === 0 ? (
          <p className="card px-4 py-8 text-center text-[13px] text-ink-muted">
            {t('stats.empty')}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile
                label={t('stats.totalTips')}
                value={numberFormat.format(stats.data.settledTips)}
              />
              <StatTile
                label={t('stats.winRate')}
                value={`${stats.data.winRate.toFixed(1)}%`}
                tone="gold"
              />
              <StatTile
                label={t('stats.roi')}
                value={`${stats.data.roi > 0 ? '+' : ''}${stats.data.roi.toFixed(2)}%`}
                tone={stats.data.roi >= 0 ? 'positive' : 'negative'}
              />
              <StatTile label={t('stats.averageOdds')} value={stats.data.avgOdds.toFixed(2)} />
              <StatTile
                label={t('stats.wins')}
                value={numberFormat.format(stats.data.won)}
                tone="positive"
              />
              <StatTile
                label={t('stats.losses')}
                value={numberFormat.format(stats.data.lost)}
                tone="negative"
              />
              <StatTile label={t('stats.void')} value={numberFormat.format(stats.data.void)} />
              <StatTile
                label={t('stats.profit')}
                value={`${stats.data.profit > 0 ? '+' : ''}${stats.data.profit.toFixed(2)}`}
                tone={stats.data.profit >= 0 ? 'positive' : 'negative'}
                hint={`${t('stats.streak')}: ${stats.data.bestStreak}`}
              />
            </div>

            <section className="card p-3">
              <h2 className="mb-2 text-[13px] font-bold">{t('stats.cumulativeProfit')}</h2>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={stats.data.byDay}
                    margin={{ top: 4, right: 4, left: -18, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#12E17F" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#12E17F" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#222834" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#6C7688', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={28}
                    />
                    <YAxis
                      tick={{ fill: '#6C7688', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#141821',
                        border: '1px solid #2A3140',
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: '#9BA5B7' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumulativeProfit"
                      name={t('stats.cumulativeProfit')}
                      stroke="#12E17F"
                      strokeWidth={2}
                      fill="url(#profitGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="card p-3">
              <h2 className="mb-2 text-[13px] font-bold">{t('stats.dailyProfit')}</h2>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.data.byDay.slice(-30)}
                    margin={{ top: 4, right: 4, left: -18, bottom: 0 }}
                  >
                    <CartesianGrid stroke="#222834" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#6C7688', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={28}
                    />
                    <YAxis
                      tick={{ fill: '#6C7688', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                    />
                    <Tooltip
                      cursor={{ fill: '#1E2430' }}
                      contentStyle={{
                        background: '#141821',
                        border: '1px solid #2A3140',
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="profit" name={t('stats.profit')} radius={[3, 3, 0, 0]}>
                      {stats.data.byDay.slice(-30).map((point) => (
                        <Cell key={point.date} fill={point.profit >= 0 ? '#12E17F' : '#FF4D5E'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="card overflow-hidden">
              <h2 className="border-b border-line-subtle px-3 py-2.5 text-[13px] font-bold">
                {t('stats.byLeague')}
              </h2>
              <ul className="divide-y divide-line-subtle">
                {stats.data.byLeague.slice(0, 10).map((bucket) => (
                  <li key={bucket.key} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-[12.5px]">{bucket.label}</span>
                    <span className="tabular shrink-0 text-[11px] text-ink-dim">
                      {bucket.tips} · {bucket.winRate.toFixed(0)}%
                    </span>
                    <span
                      className={clsx(
                        'tabular w-16 shrink-0 text-right text-[12.5px] font-bold',
                        bucket.profit >= 0 ? 'text-won' : 'text-lost',
                      )}
                    >
                      {bucket.profit > 0 ? '+' : ''}
                      {bucket.profit.toFixed(1)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card overflow-hidden">
              <h2 className="border-b border-line-subtle px-3 py-2.5 text-[13px] font-bold">
                {t('stats.byMarket')}
              </h2>
              <ul className="divide-y divide-line-subtle">
                {stats.data.byMarket.slice(0, 10).map((bucket) => (
                  <li key={bucket.key} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-[12.5px]">{bucket.label}</span>
                    <span className="tabular shrink-0 text-[11px] text-ink-dim">
                      {bucket.tips} · {bucket.avgOdds.toFixed(2)}
                    </span>
                    <span
                      className={clsx(
                        'tabular w-16 shrink-0 text-right text-[12.5px] font-bold',
                        bucket.profit >= 0 ? 'text-won' : 'text-lost',
                      )}
                    >
                      {bucket.profit > 0 ? '+' : ''}
                      {bucket.profit.toFixed(1)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        <ResponsibleGamblingNote />
      </div>
    </AppShell>
  );
}
