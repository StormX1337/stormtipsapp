'use client';

import { Suspense, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import clsx from 'clsx';
import type { Paginated, ProductCode, TipDTO } from '@profit-tips/types';
import { formatShortDate } from '@profit-tips/ui';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/navigation';
import { ErrorState, NoResults, ResponsibleGamblingNote } from '@/components/states';
import { Button, Skeleton, StatusBadge } from '@/components/primitives';

const PRODUCTS: (ProductCode | 'ALL')[] = ['ALL', 'FREE', 'VIP', 'EXTRA', 'COMBO', 'FIX_ODDS'];

function HistoryContent(): ReactNode {
  const { t, locale } = useI18n();
  const searchParams = useSearchParams();
  const [product, setProduct] = useState<ProductCode | 'ALL'>(
    (searchParams.get('product') as ProductCode | null) ?? 'ALL',
  );
  const [page, setPage] = useState(1);

  const history = useQuery({
    queryKey: ['history', product, page],
    queryFn: () =>
      api<Paginated<TipDTO>>(
        `/tips/history?page=${page}&limit=25${product === 'ALL' ? '' : `&product=${product}`}`,
        { auth: false },
      ),
  });

  return (
    <div id="main" className="flex flex-col gap-3 py-4">
      <div className="no-scrollbar -mx-[var(--page-gutter)] flex gap-2 overflow-x-auto px-[var(--page-gutter)]">
        {PRODUCTS.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => {
              setProduct(code);
              setPage(1);
            }}
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

      {history.isPending ? (
        Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)
      ) : history.isError ? (
        <ErrorState error={history.error} onRetry={() => void history.refetch()} />
      ) : history.data.items.length === 0 ? (
        <NoResults />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[12.5px]">
              <thead className="border-b border-line-subtle text-[11px] tracking-wide text-ink-dim uppercase">
                <tr>
                  <th className="px-3 py-2 font-semibold">{t('common.today')}</th>
                  <th className="px-3 py-2 font-semibold">{t('tip.selection')}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t('common.odds')}</th>
                  <th className="px-3 py-2 text-center font-semibold">
                    {t('subscription.status')}
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">{t('tip.profit')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {history.data.items.map((tip) => (
                  <tr key={tip.id}>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink-dim">
                      {tip.settledAt ? formatShortDate(tip.settledAt, undefined, locale) : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="truncate font-medium">{tip.selectionLabel}</p>
                      <p className="truncate text-[11px] text-ink-dim">
                        {tip.event.homeTeam.shortName ?? tip.event.homeTeam.name} –{' '}
                        {tip.event.awayTeam.shortName ?? tip.event.awayTeam.name}
                      </p>
                    </td>
                    <td className="tabular px-3 py-2.5 text-right font-bold">
                      {tip.odds?.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <StatusBadge outcome={tip.outcome} compact={false} />
                    </td>
                    <td
                      className={clsx(
                        'tabular px-3 py-2.5 text-right font-bold',
                        (tip.result?.profit ?? 0) > 0
                          ? 'text-won'
                          : (tip.result?.profit ?? 0) < 0
                            ? 'text-lost'
                            : 'text-ink-muted',
                      )}
                    >
                      {tip.result
                        ? `${tip.result.profit > 0 ? '+' : ''}${tip.result.profit.toFixed(2)}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              {t('common.back')}
            </Button>
            <span className="text-[12px] text-ink-dim">
              {page} / {history.data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!history.data.hasNext}
              onClick={() => setPage((value) => value + 1)}
            >
              {t('common.next')}
            </Button>
          </div>
        </>
      )}

      <ResponsibleGamblingNote />
    </div>
  );
}

export default function HistoryPage(): ReactNode {
  const { t } = useI18n();
  return (
    <AppShell title={t('nav.history')}>
      <Suspense fallback={<Skeleton className="mt-6 h-64 w-full" />}>
        <HistoryContent />
      </Suspense>
    </AppShell>
  );
}
