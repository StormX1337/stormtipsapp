'use client';

import clsx from 'clsx';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { intlLocale, toDateKey } from '@storm-tips/ui';
import { useI18n } from '@/lib/i18n';

/**
 * Horizontal date picker.
 *
 * Shows a window of days around today; the selected day is bold white with an
 * accent underline, matching the reference feed.
 */
export function DateStrip({
  value,
  onChange,
  daysBefore = 7,
  daysAfter = 7,
}: {
  value: string;
  onChange: (date: string) => void;
  daysBefore?: number;
  daysAfter?: number;
}): ReactNode {
  const { locale, t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const days = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return Array.from({ length: daysBefore + daysAfter + 1 }, (_, index) => {
      const date = new Date(today.getTime() + (index - daysBefore) * 86_400_000);
      return {
        key: toDateKey(date),
        weekday: new Intl.DateTimeFormat(intlLocale(locale), {
          weekday: 'short',
        }).format(date),
        month: new Intl.DateTimeFormat(intlLocale(locale), {
          month: 'short',
        }).format(date),
        day: date.getDate(),
        isToday: index === daysBefore,
      };
    });
  }, [daysBefore, daysAfter, locale]);

  // Keep the selected day visible when the strip first renders.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [value]);

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label="Datum"
      className="no-scrollbar -mx-[var(--page-gutter)] flex gap-1 overflow-x-auto border-b border-line-subtle px-[var(--page-gutter)]"
    >
      {days.map((day) => {
        const active = day.key === value;
        return (
          <button
            key={day.key}
            ref={active ? activeRef : undefined}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(day.key)}
            className={clsx(
              'relative flex w-[58px] shrink-0 flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors',
              active ? 'text-ink' : 'text-ink-dim hover:text-ink-muted',
            )}
          >
            <span className={clsx('leading-none', active && 'font-bold')}>
              {day.isToday ? t('common.today') : day.weekday}
            </span>
            <span className={clsx('leading-none', active ? 'font-bold' : 'font-medium')}>
              {day.month} {day.day}
            </span>
            {active ? (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent-500" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
