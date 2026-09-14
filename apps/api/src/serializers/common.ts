import type { Prisma } from '@storm-tips/database';
import { formatMoney } from '@storm-tips/ui';
import type { Money } from '@storm-tips/types';

/** Prisma Decimal → number. Safe for the magnitudes we store (odds, money). */
export function dec(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' ? value : Number(value);
}

export function decOr(value: Prisma.Decimal | number | null | undefined, fallback: number): number {
  return dec(value) ?? fallback;
}

export function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function money(amountCents: number, currency: string): Money {
  return { amountCents, currency, formatted: formatMoney(amountCents, currency) };
}
