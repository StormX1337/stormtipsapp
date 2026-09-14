import type { SupportedCurrency } from './types.js';

/**
 * App locale → the BCP-47 tag `Intl` should format with.
 *
 * One table, so a screen that needs its own `Intl` formatter asks here instead
 * of hard-coding a tag that would then be missed if a locale is ever added.
 */
const CURRENCY_LOCALE: Record<string, string> = { en: 'en-GB' };

export function intlLocale(locale = 'en'): string {
  return CURRENCY_LOCALE[locale] ?? locale;
}

/** Formats minor units (cents) into a localised currency string. */
export function formatMoney(
  amountCents: number,
  currency: SupportedCurrency | string = 'EUR',
  locale = 'en',
): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

/** Formats a whole-unit amount (e.g. a profit of 124.5 units). */
export function formatUnits(amount: number, locale = 'en', digits = 2): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

/** Odds are always shown with two decimals, e.g. 1.33 / 3.20. */
export function formatOdds(odds: number | string | null | undefined): string {
  if (odds === null || odds === undefined) return '—';
  const value = typeof odds === 'string' ? Number.parseFloat(odds) : odds;
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(2);
}

export function formatPercent(value: number, locale = 'en', digits = 1): string {
  return `${new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)}%`;
}

/** Compact display for the statistics circles, e.g. "1,2K" for 1200. */
export function formatCompact(value: number, locale = 'en'): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatSignedUnits(amount: number, locale = 'en'): string {
  const sign = amount > 0 ? '+' : '';
  return `${sign}${formatUnits(amount, locale)}`;
}

export function formatKickoff(iso: string, timezone?: string, locale = 'en'): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(new Date(iso));
}

export function formatShortDate(iso: string, timezone?: string, locale = 'en'): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: '2-digit',
    month: 'short',
    timeZone: timezone,
  }).format(new Date(iso));
}

export function formatWeekday(iso: string, timezone?: string, locale = 'en'): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'short',
    timeZone: timezone,
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, timezone?: string, locale = 'en'): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(iso));
}

/** "in 2 h", "vor 5 min" — used for kickoff countdowns. */
export function formatRelative(iso: string, locale = 'en', now = new Date()): string {
  const diffMs = new Date(iso).getTime() - now.getTime();
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
    ['second', 1000],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms || unit === 'second') {
      return rtf.format(Math.round(diffMs / ms), unit);
    }
  }
  return rtf.format(0, 'second');
}

/** Local YYYY-MM-DD key used by the date strip and feed grouping. */
export function toDateKey(date: Date | string, timezone?: string): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  if (!timezone) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
  return parts;
}

/** Masks an email for public display: "iv***@gmail.com". */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
