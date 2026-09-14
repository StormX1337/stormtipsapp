'use client';

import { use, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ChevronLeft, Lock } from 'lucide-react';
import type { TipDTO } from '@storm-tips/types';
import { formatDateTime } from '@storm-tips/ui';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/navigation';
import { ErrorState } from '@/components/states';
import {
  Button,
  ConfidenceMeter,
  CountryFlag,
  OddsBadge,
  Skeleton,
  StatusBadge,
  TeamCrest,
} from '@/components/primitives';

function Row({ label, value }: { label: string; value: ReactNode }): ReactNode {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-[12.5px] text-ink-muted">{label}</dt>
      <dd className="text-right text-[12.5px] font-semibold">{value}</dd>
    </div>
  );
}

export default function TipDetailPage({ params }: { params: Promise<{ id: string }> }): ReactNode {
  const { id } = use(params);
  const { t, locale } = useI18n();
  const router = useRouter();

  const query = useQuery({
    queryKey: ['tip', id],
    queryFn: () => api<TipDTO>(`/tips/${id}`),
  });

  const tip = query.data;

  return (
    <AppShell
      title={tip ? tip.league.name : t('common.loading')}
      left={
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-md text-ink-muted hover:bg-bg-card hover:text-ink"
        >
          <ChevronLeft size={22} aria-hidden />
        </button>
      }
    >
      <div id="main" className="flex flex-col gap-3 py-4">
        {query.isPending ? (
          <>
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-40 w-full" />
          </>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : tip ? (
          <>
            <section className="card p-4">
              <div className="flex items-center gap-2 pb-3 text-[12px] text-ink-muted">
                <CountryFlag emoji={tip.country?.flagEmoji} code={tip.country?.code} />
                <span className="truncate">
                  {tip.country?.name ? `${tip.country.name} : ` : ''}
                  {tip.league.name}
                </span>
                <span className="ml-auto">
                  <StatusBadge outcome={tip.outcome} compact={false} />
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <TeamCrest
                      name={tip.event.homeTeam.name}
                      logoUrl={tip.event.homeTeam.logoUrl}
                      color={tip.event.homeTeam.colorPrimary}
                      size={26}
                    />
                    <span className="truncate text-[15px] font-semibold">
                      {tip.event.homeTeam.name}
                    </span>
                    {tip.event.homeScore !== null ? (
                      <span className="tabular ml-auto text-[16px] font-bold">
                        {tip.event.homeScore}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <TeamCrest
                      name={tip.event.awayTeam.name}
                      logoUrl={tip.event.awayTeam.logoUrl}
                      color={tip.event.awayTeam.colorPrimary}
                      size={26}
                    />
                    <span className="truncate text-[15px] font-semibold">
                      {tip.event.awayTeam.name}
                    </span>
                    {tip.event.awayScore !== null ? (
                      <span className="tabular ml-auto text-[16px] font-bold">
                        {tip.event.awayScore}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <p className="mt-3 text-[12px] text-ink-dim">
                {t('feed.kickoff')}: {formatDateTime(tip.event.startsAt, undefined, locale)}
                {tip.event.venue ? ` · ${tip.event.venue}` : ''}
              </p>
            </section>

            {tip.isLocked ? (
              <section className="card flex flex-col items-center gap-3 p-6 text-center">
                <Lock size={26} className="text-gold-300" aria-hidden />
                <p className="text-[15px] font-bold">{t('feed.lockedTitle')}</p>
                <p className="max-w-sm text-[13px] text-ink-muted">
                  {t('feed.lockedBody', { product: t(`product.${tip.product}` as never) })}
                </p>
                <Link href={`/paywall/${tip.product.toLowerCase().replace('_', '-')}`}>
                  <Button variant="gold">
                    {t(
                      tip.product === 'VIP'
                        ? 'paywall.getVip'
                        : tip.product === 'EXTRA'
                          ? 'paywall.getExtra'
                          : tip.product === 'COMBO'
                            ? 'paywall.getCombo'
                            : 'paywall.getFixOdds',
                    )}
                  </Button>
                </Link>
              </section>
            ) : (
              <>
                <section className="card p-4">
                  <p className="text-[11px] tracking-wide text-ink-dim uppercase">
                    {t('tip.selection')}
                  </p>
                  <p className="mt-1 text-[16px] font-extrabold tracking-tight text-accent-500 uppercase">
                    {tip.selectionLabel}
                  </p>
                  <div className="mt-3 flex items-center gap-4">
                    <OddsBadge odds={tip.odds} size="lg" changed={tip.oddsChanged} />
                    <ConfidenceMeter value={tip.confidence} />
                  </div>

                  <dl className="mt-3 divide-y divide-line-subtle border-t border-line-subtle pt-1">
                    <Row label={t('tip.market')} value={tip.marketName} />
                    {tip.bookmaker ? (
                      <Row
                        label={t('tip.bookmaker')}
                        value={
                          <span style={{ color: tip.bookmaker.color ?? undefined }}>
                            {tip.bookmaker.name}
                          </span>
                        }
                      />
                    ) : null}
                    <Row
                      label={t('tip.originalOdds')}
                      value={tip.originalOdds?.toFixed(2) ?? '—'}
                    />
                    <Row
                      label={t('tip.currentOdds')}
                      value={
                        <span className={clsx(tip.oddsChanged && 'text-gold-400')}>
                          {tip.currentOdds?.toFixed(2) ?? '—'}
                          {tip.oddsChanged ? ` · ${t('tip.oddsChanged')}` : ''}
                        </span>
                      }
                    />
                    <Row label={t('tip.stake')} value={tip.stake.toFixed(2)} />
                    {tip.publishAt ? (
                      <Row
                        label={t('tip.publishedAt')}
                        value={formatDateTime(tip.publishAt, undefined, locale)}
                      />
                    ) : null}
                  </dl>
                </section>

                {tip.result ? (
                  <section className="card p-4">
                    <p className="text-[11px] tracking-wide text-ink-dim uppercase">
                      {t('subscription.status')}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <StatusBadge outcome={tip.result.outcome} compact={false} />
                      <span
                        className={clsx(
                          'tabular text-[18px] font-extrabold',
                          tip.result.profit > 0
                            ? 'text-won'
                            : tip.result.profit < 0
                              ? 'text-lost'
                              : 'text-ink-muted',
                        )}
                      >
                        {tip.result.profit > 0 ? '+' : ''}
                        {tip.result.profit.toFixed(2)}
                      </span>
                    </div>
                  </section>
                ) : null}

                <section className="card p-4">
                  <h2 className="text-[13px] font-bold">{t('tip.analysis')}</h2>
                  <p className="mt-2 text-[13px] leading-relaxed whitespace-pre-line text-ink-muted">
                    {tip.analysis ?? t('tip.noAnalysis')}
                  </p>
                </section>
              </>
            )}

            <p className="rounded-md border border-line-subtle px-3 py-2 text-center text-[11px] text-ink-dim">
              {t('legal.noGuarantee')}
            </p>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
