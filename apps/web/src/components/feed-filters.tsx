'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export interface FeedFilterState {
  q: string;
  marketType: string;
  minOdds: string;
  maxOdds: string;
}

export const EMPTY_FILTERS: FeedFilterState = { q: '', marketType: '', minOdds: '', maxOdds: '' };

/** How many filters are narrowing the feed right now. */
export function activeFilterCount(filters: FeedFilterState): number {
  return Object.values(filters).filter((value) => value !== '').length;
}

/** Turns the state into the query string the feed endpoint understands. */
export function filtersToQuery(filters: FeedFilterState): string {
  const params = new URLSearchParams();
  // The API rejects a one-character search rather than scanning the table for
  // it, so it is not sent until it could match something.
  if (filters.q.trim().length >= 2) params.set('q', filters.q.trim());
  if (filters.marketType) params.set('marketType', filters.marketType);
  if (filters.minOdds) params.set('minOdds', filters.minOdds);
  if (filters.maxOdds) params.set('maxOdds', filters.maxOdds);
  const query = params.toString();
  return query ? `&${query}` : '';
}

/**
 * Search and filters over the feed.
 *
 * The search matches teams and leagues, never the selection: on a locked tip
 * the pick is stripped from the payload, and a search that matched it would
 * hand it back a word at a time.
 *
 * The market list is built from the tips actually in this feed rather than from
 * the full enum, so it never offers a market that would return nothing.
 */
export function FeedFilters({
  value,
  onChange,
  markets,
}: {
  value: FeedFilterState;
  onChange: (next: FeedFilterState) => void;
  markets: { type: string; name: string }[];
}): ReactNode {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value.q);
  const active = activeFilterCount(value);

  // Typing should not fire a request per keystroke.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    if (text === value.q) return;
    const timer = setTimeout(() => onChangeRef.current({ ...value, q: text }), 300);
    return () => clearTimeout(timer);
  }, [text, value]);

  function set(patch: Partial<FeedFilterState>): void {
    onChange({ ...value, ...patch });
  }

  return (
    <div className="flex flex-col gap-2 pt-2">
      <div className="flex items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <Search
            size={15}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-dim"
          />
          <input
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t('feed.search')}
            aria-label={t('feed.search')}
            className="field-input w-full rounded-md border border-line bg-bg-input py-2 pr-3 pl-9 text-[13px] outline-none focus:border-accent-500"
          />
        </label>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          className={clsx(
            'press flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-[12.5px] font-semibold transition-colors',
            active > 0
              ? 'border-accent-500/50 text-accent-500'
              : 'border-line text-ink-muted hover:text-ink',
          )}
        >
          <SlidersHorizontal size={14} aria-hidden />
          {t('feed.filters')}
          {active > 0 ? (
            <span className="tabular rounded-full bg-accent-500 px-1.5 text-[11px] text-ink-inverse">
              {active}
            </span>
          ) : null}
        </button>
      </div>

      {open ? (
        <div className="card animate-rise flex flex-wrap items-end gap-3 p-3">
          <label className="flex w-full min-w-[160px] max-w-[260px] flex-col gap-1">
            <span className="field-label text-[11px] tracking-wide text-ink-dim uppercase">
              {t('feed.market')}
            </span>
            <select
              value={value.marketType}
              onChange={(event) => set({ marketType: event.target.value })}
              className="field-input rounded-md border border-line bg-bg-input px-2.5 py-2 text-[13px] outline-none focus:border-accent-500"
            >
              <option value="">{t('feed.anyMarket')}</option>
              {markets.map((market) => (
                <option key={market.type} value={market.type}>
                  {market.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex w-24 flex-col gap-1">
            <span className="field-label text-[11px] tracking-wide text-ink-dim uppercase">
              {t('feed.minOdds')}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              step={0.05}
              value={value.minOdds}
              onChange={(event) => set({ minOdds: event.target.value })}
              className="field-input tabular rounded-md border border-line bg-bg-input px-2.5 py-2 text-[13px] outline-none focus:border-accent-500"
            />
          </label>

          <label className="flex w-24 flex-col gap-1">
            <span className="field-label text-[11px] tracking-wide text-ink-dim uppercase">
              {t('feed.maxOdds')}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              step={0.05}
              value={value.maxOdds}
              onChange={(event) => set({ maxOdds: event.target.value })}
              className="field-input tabular rounded-md border border-line bg-bg-input px-2.5 py-2 text-[13px] outline-none focus:border-accent-500"
            />
          </label>

          {active > 0 ? (
            <button
              type="button"
              onClick={() => {
                setText('');
                onChange(EMPTY_FILTERS);
              }}
              className="press ml-auto flex items-center gap-1 rounded-md px-2.5 py-2 text-[12.5px] font-semibold text-ink-muted hover:text-ink"
            >
              <X size={14} aria-hidden />
              {t('feed.clearFilters')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
