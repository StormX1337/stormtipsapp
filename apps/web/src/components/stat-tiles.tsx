'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';

/** Compact KPI tile used across the statistics and account screens. */
export function StatTile({
  label,
  value,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'negative' | 'gold';
  hint?: string;
}): ReactNode {
  return (
    <div className="card px-3 py-2.5">
      <p className="text-[11px] font-medium tracking-wide text-ink-dim uppercase">{label}</p>
      <p
        className={clsx(
          'tabular mt-1 text-[18px] leading-none font-extrabold',
          tone === 'positive' && 'text-won',
          tone === 'negative' && 'text-lost',
          tone === 'gold' && 'text-gold-400',
          tone === 'neutral' && 'text-ink',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-ink-dim">{hint}</p> : null}
    </div>
  );
}
