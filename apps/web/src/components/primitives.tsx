'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { ProductCode, TipOutcome } from '@storm-tips/types';
import { useT } from '@/lib/i18n';

/* ── team crest ─────────────────────────────────────────────────────────────
 * No third-party crest images are bundled. When a club supplies a logo URL it
 * is used; otherwise a coloured monogram stands in, which keeps the row height
 * identical either way.
 */
export function TeamCrest({
  name,
  logoUrl,
  color,
  size = 20,
}: {
  name: string;
  logoUrl?: string | null;
  color?: string | null;
  size?: number;
}): ReactNode {
  const initials = name
    .replace(/^(FC|SC|SV|AC|AS|SS|VfB|RB|1\.)\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-contain"
        loading="lazy"
      />
    );
  }

  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-bold text-ink-inverse"
      style={{
        width: size,
        height: size,
        backgroundColor: color ?? '#2A3140',
        fontSize: size * 0.42,
        color: color ? contrastOn(color) : '#9BA5B7',
      }}
    >
      {initials || '?'}
    </span>
  );
}

/** Picks black or white text for a background colour (WCAG relative luminance). */
function contrastOn(hex: string): string {
  const value = hex.replace('#', '');
  if (value.length < 6) return '#0A0C10';
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
  const channel = (c: number): number => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
  return luminance > 0.45 ? '#0A0C10' : '#FFFFFF';
}

/* ── country flag ──────────────────────────────────────────────────────────── */
export function CountryFlag({
  emoji,
  code,
  className,
}: {
  emoji?: string | null;
  code?: string | null;
  className?: string;
}): ReactNode {
  if (emoji) {
    return (
      <span className={clsx('text-base leading-none', className)} aria-hidden>
        {emoji}
      </span>
    );
  }
  // A league the provider gave no country for renders nothing rather than "??",
  // which reads as a fault in the page instead of an absent detail.
  if (!code) return null;
  return (
    <span
      className={clsx(
        'rounded-xs bg-bg-card-alt px-1 text-[9px] font-bold tracking-wider text-ink-dim',
        className,
      )}
      aria-hidden
    >
      {code}
    </span>
  );
}

/* ── odds ──────────────────────────────────────────────────────────────────── */
export function OddsBadge({
  odds,
  locked,
  changed,
  size = 'md',
}: {
  odds: number | null;
  locked?: boolean;
  changed?: boolean;
  size?: 'sm' | 'md' | 'lg';
}): ReactNode {
  const text = locked || odds === null ? '•••' : odds.toFixed(2);
  return (
    <span
      className={clsx(
        'tabular font-bold text-accent-500',
        size === 'sm' && 'text-[13px]',
        size === 'md' && 'text-[17px]',
        size === 'lg' && 'text-[22px]',
        locked && 'text-ink-dim',
      )}
      title={changed ? 'The price has moved since publication' : undefined}
    >
      {text}
      {changed && !locked ? <span className="ml-1 text-[11px] text-gold-400">▲▼</span> : null}
    </span>
  );
}

/* ── outcome ───────────────────────────────────────────────────────────────── */
const OUTCOME_STYLE: Record<TipOutcome, string> = {
  PENDING: 'bg-bg-card-alt text-ink-dim',
  LIVE: 'bg-live/15 text-live',
  WON: 'bg-won/15 text-won',
  LOST: 'bg-lost/15 text-lost',
  VOID: 'bg-void/15 text-void',
  HALF_WON: 'bg-half-won/15 text-half-won',
  HALF_LOST: 'bg-half-lost/15 text-half-lost',
};

const OUTCOME_GLYPH: Record<TipOutcome, string> = {
  PENDING: '–',
  LIVE: '●',
  WON: '✓',
  LOST: '✕',
  VOID: '=',
  HALF_WON: '½✓',
  HALF_LOST: '½✕',
};

export function StatusBadge({
  outcome,
  compact = true,
}: {
  outcome: TipOutcome;
  compact?: boolean;
}): ReactNode {
  const t = useT();
  const label = t(`status.${outcome}` as never);

  if (compact) {
    return (
      <span
        className={clsx(
          'grid h-5 min-w-5 shrink-0 place-items-center rounded-sm px-1 text-[11px] font-bold leading-none',
          OUTCOME_STYLE[outcome],
          outcome === 'LIVE' && 'live-dot',
        )}
        title={label}
        aria-label={label}
      >
        {OUTCOME_GLYPH[outcome]}
      </span>
    );
  }

  /*
   * The glyph is how the compact badge says anything at all. Beside the written
   * label it only repeats it — and for a pending tip the glyph is a dash, so the
   * badge read "– PENDING", which looks like a rendering fault.
   */
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide',
        OUTCOME_STYLE[outcome],
      )}
    >
      {label}
    </span>
  );
}

/* ── product + promo badges ────────────────────────────────────────────────── */
export const PRODUCT_ACCENT: Record<ProductCode, string> = {
  FREE: 'text-accent-500',
  COMBO: 'text-gold-400',
  EXTRA: 'text-cyan-500',
  VIP: 'text-gold-300',
  FIX_ODDS: 'text-violet-500',
};

export function ProductBadge({ product }: { product: ProductCode }): ReactNode {
  const t = useT();
  if (product === 'FREE') return null;
  return (
    <span
      className={clsx(
        'rounded-xs border border-line px-1.5 py-px text-[10px] font-bold uppercase tracking-wider',
        PRODUCT_ACCENT[product],
      )}
    >
      {t(`product.${product}` as never)}
    </span>
  );
}

const PROMO_BADGE_STYLE: Record<string, string> = {
  MOST_POPULAR: 'bg-pink-500 text-white',
  LIMITED: 'bg-cyan-500 text-ink-inverse',
  SALE: 'bg-accent-500 text-ink-inverse',
  NEW: 'bg-violet-500 text-white',
  BEST_VALUE: 'bg-gold-400 text-ink-inverse',
};

export function PromoBadge({ badge }: { badge: string }): ReactNode {
  const t = useT();
  if (!badge || badge === 'NONE') return null;
  const labels: Record<string, string> = {
    MOST_POPULAR: t('paywall.mostPopular'),
    LIMITED: t('paywall.limited'),
    SALE: t('paywall.sale'),
    NEW: t('paywall.new'),
    BEST_VALUE: t('paywall.bestValue'),
  };
  return (
    <span
      className={clsx(
        'rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap',
        PROMO_BADGE_STYLE[badge] ?? 'bg-bg-card-alt text-ink-muted',
      )}
    >
      {labels[badge] ?? badge}
    </span>
  );
}

/* ── confidence ────────────────────────────────────────────────────────────── */
export function ConfidenceMeter({ value }: { value: number | null }): ReactNode {
  const t = useT();
  if (value === null) return null;
  const filled = Math.round((value / 100) * 5);
  return (
    <span className="inline-flex items-center gap-1" title={`${t('tip.confidence')}: ${value}%`}>
      <span className="flex gap-0.5" aria-hidden>
        {Array.from({ length: 5 }, (_, index) => (
          <span
            key={index}
            className={clsx(
              'h-1 w-3 rounded-full',
              index < filled ? 'bg-accent-500' : 'bg-line-strong',
            )}
          />
        ))}
      </span>
      <span className="tabular text-[11px] text-ink-dim">{value}%</span>
    </span>
  );
}

/* ── generic surfaces ──────────────────────────────────────────────────────── */
export function Skeleton({ className }: { className?: string }): ReactNode {
  return <div className={clsx('skeleton', className)} aria-hidden />;
}

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: ReactNode;
}): ReactNode {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line px-6 py-12 text-center">
      {icon ? <div className="text-ink-dim">{icon}</div> : null}
      <p className="text-[15px] font-semibold">{title}</p>
      {body ? <p className="max-w-sm text-[13px] text-ink-muted">{body}</p> : null}
      {action}
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: {
  children: ReactNode;
  variant?: 'primary' | 'gold' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
} & React.ButtonHTMLAttributes<HTMLButtonElement>): ReactNode {
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-md font-bold transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'px-3 py-1.5 text-[12px]',
        size === 'md' && 'px-4 py-2.5 text-[13px]',
        size === 'lg' && 'w-full px-5 py-3.5 text-[15px]',
        variant === 'primary' && 'bg-accent-500 text-ink-inverse hover:bg-accent-400',
        variant === 'gold' && 'bg-gold-400 text-ink-inverse hover:bg-gold-300',
        variant === 'ghost' && 'text-ink-muted hover:bg-bg-card-alt hover:text-ink',
        variant === 'outline' && 'border border-line-strong text-ink hover:border-accent-500',
        variant === 'danger' && 'bg-lost/15 text-lost hover:bg-lost/25',
        className,
      )}
    >
      {children}
    </button>
  );
}
