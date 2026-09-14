'use client';

import clsx from 'clsx';
import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ComboDTO } from '@storm-tips/types';
import { formatDateTime } from '@storm-tips/ui';
import { useI18n } from '@/lib/i18n';
import { StatusBadge, TeamCrest } from './primitives';

/** An accumulator with its legs listed underneath, as sold in the Combo product. */
export function ComboCard({ combo }: { combo: ComboDTO }): ReactNode {
  const { t, locale } = useI18n();

  return (
    <article className="card overflow-hidden">
      <header className="flex items-start gap-3 border-b border-line-subtle p-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-bold">{combo.title}</h3>
          <p className="mt-0.5 text-[11px] text-ink-dim">
            {combo.publishAt ? formatDateTime(combo.publishAt, undefined, locale) : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-semibold tracking-wide text-ink-dim uppercase">
            {t('common.odds')}
          </p>
          <p
            className={clsx(
              'tabular text-[19px] font-extrabold',
              combo.isLocked ? 'text-ink-dim' : 'text-gold-400',
            )}
          >
            {combo.isLocked ? '•••' : (combo.totalOdds?.toFixed(2) ?? '—')}
          </p>
        </div>
        <StatusBadge outcome={combo.outcome} />
      </header>

      <ol className="divide-y divide-line-subtle">
        {combo.items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 px-3 py-2.5">
            <TeamCrest
              name={item.event.homeTeam.name}
              logoUrl={item.event.homeTeam.logoUrl}
              color={item.event.homeTeam.colorPrimary}
              size={18}
            />
            <TeamCrest
              name={item.event.awayTeam.name}
              logoUrl={item.event.awayTeam.logoUrl}
              color={item.event.awayTeam.colorPrimary}
              size={18}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] text-ink">
                {item.event.homeTeam.shortName ?? item.event.homeTeam.name} –{' '}
                {item.event.awayTeam.shortName ?? item.event.awayTeam.name}
              </p>
              <p
                className={clsx(
                  'truncate text-[11.5px] font-bold uppercase',
                  item.isLocked ? 'text-ink-dim' : 'text-accent-500',
                )}
              >
                {item.isLocked ? (
                  <span className="inline-flex items-center gap-1">
                    <Lock size={10} aria-hidden /> {t('feed.lockedTitle')}
                  </span>
                ) : (
                  item.selectionLabel
                )}
              </p>
            </div>
            <span className="tabular shrink-0 text-[13px] font-bold text-ink-muted">
              {item.isLocked ? '•••' : item.odds?.toFixed(2)}
            </span>
            <StatusBadge outcome={item.outcome} />
          </li>
        ))}
      </ol>

      {!combo.isLocked && combo.potentialReturn !== null ? (
        <footer className="flex items-center justify-between gap-3 bg-bg-card-alt px-3 py-2 text-[12px]">
          <span className="text-ink-muted">
            {t('tip.stake')}: <span className="tabular text-ink">{combo.stake.toFixed(2)}</span>
          </span>
          <span className="text-ink-muted">
            {t('tip.profit')}:{' '}
            <span
              className={clsx(
                'tabular font-bold',
                (combo.profit ?? 0) > 0
                  ? 'text-won'
                  : (combo.profit ?? 0) < 0
                    ? 'text-lost'
                    : 'text-ink',
              )}
            >
              {combo.profit === null
                ? `→ ${combo.potentialReturn.toFixed(2)}`
                : `${combo.profit > 0 ? '+' : ''}${combo.profit.toFixed(2)}`}
            </span>
          </span>
        </footer>
      ) : null}
    </article>
  );
}
