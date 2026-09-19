'use client';

import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { intlLocale, toDateKey } from '@storm-tips/ui';
import { useI18n } from '@/lib/i18n';

/**
 * Horizontal date picker.
 *
 * Shows a window of days around today. The underline is a single bar that
 * slides between days rather than one drawn inside each button: moved, it says
 * which day you came from as well as which you are on, which is the whole point
 * of a strip you scrub along.
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
  const [marker, setMarker] = useState<{ left: number; width: number } | null>(null);

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

  /**
   * Measured from the button rather than assumed: the labels are localised, so
   * a hard-coded width would be wrong in the first language that spells a
   * weekday differently.
   */
  const placeMarker = useCallback(() => {
    const button = activeRef.current;
    if (!button) return;
    setMarker({ left: button.offsetLeft + 8, width: button.offsetWidth - 16 });
  }, []);

  // Keep the selected day visible when the strip first renders.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
    placeMarker();
  }, [value, placeMarker]);

  // The strip is horizontally scrollable, so its buttons move under a resize.
  useEffect(() => {
    window.addEventListener('resize', placeMarker);
    return () => window.removeEventListener('resize', placeMarker);
  }, [placeMarker]);

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label="Date"
      className="no-scrollbar relative -mx-[var(--page-gutter)] flex gap-1 overflow-x-auto border-b border-line-subtle px-[var(--page-gutter)]"
    >
      {marker ? (
        <span
          aria-hidden
          className="absolute bottom-0 h-0.5 rounded-full bg-accent-500 transition-[left,width] duration-300 ease-out"
          style={{ left: marker.left, width: marker.width }}
        />
      ) : null}
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
            {/* Until the marker has been measured, the active day draws its own
                underline — otherwise the first paint shows none at all. */}
            {active && !marker ? (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent-500" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
