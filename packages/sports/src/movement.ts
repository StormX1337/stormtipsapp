import type { OddsMovement } from '@profit-tips/types';

/**
 * Classifies an odds change relative to its opening price.
 *
 * `threshold` is a relative delta (0.05 = 5%); anything beyond it is reported as
 * a significant move, which is what drives the "odds changed" badge on a tip.
 */
export function classifyMovement(
  openingPrice: number,
  currentPrice: number,
  threshold = 0.05,
): OddsMovement {
  if (!Number.isFinite(openingPrice) || openingPrice <= 0) return 'STABLE';
  const delta = (currentPrice - openingPrice) / openingPrice;
  if (Math.abs(delta) < 0.001) return 'STABLE';
  if (delta >= threshold) return 'SIGNIFICANT_UP';
  if (delta <= -threshold) return 'SIGNIFICANT_DOWN';
  return delta > 0 ? 'UP' : 'DOWN';
}

export function relativeDelta(openingPrice: number, currentPrice: number): number {
  if (!Number.isFinite(openingPrice) || openingPrice <= 0) return 0;
  return Math.round(((currentPrice - openingPrice) / openingPrice) * 10_000) / 10_000;
}

/** True when the current price moved far enough from the tipped price to warn the user. */
export function isStale(
  tippedOdds: number,
  currentOdds: number | null | undefined,
  threshold = 0.05,
): boolean {
  if (currentOdds === null || currentOdds === undefined) return false;
  return Math.abs(relativeDelta(tippedOdds, currentOdds)) >= threshold;
}

/** Best available price across bookmakers for one selection. */
export function bestPrice<T extends { price: number }>(quotes: T[]): T | null {
  if (quotes.length === 0) return null;
  return quotes.reduce((best, quote) => (quote.price > best.price ? quote : best));
}

/** Implied probability including the bookmaker margin. */
export function impliedProbability(price: number): number {
  if (price <= 1) return 1;
  return Math.round((1 / price) * 10_000) / 10_000;
}

/** Total book margin (overround) for a full market, e.g. 1.05 = 5% margin. */
export function bookMargin(prices: number[]): number {
  const sum = prices.reduce((acc, price) => acc + impliedProbability(price), 0);
  return Math.round(sum * 10_000) / 10_000;
}
