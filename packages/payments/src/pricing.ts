import type { BillingInterval, DiscountType } from '@storm-tips/types';

/** Number of months a billing interval covers (used for "per month" pricing). */
export function intervalMonths(interval: BillingInterval, count: number): number {
  switch (interval) {
    case 'DAY':
      return (count * 1) / 30;
    case 'WEEK':
      return (count * 7) / 30;
    case 'MONTH':
      return count;
    case 'YEAR':
      return count * 12;
    case 'ONE_TIME':
    default:
      return count;
  }
}

/** Price per month in minor units, rounded to the nearest cent. */
export function pricePerMonthCents(
  priceCents: number,
  interval: BillingInterval,
  intervalCount: number,
): number | null {
  const months = intervalMonths(interval, intervalCount);
  if (months <= 1) return null;
  return Math.round(priceCents / months);
}

/** Saving versus paying the reference monthly price for the same duration. */
export function savingsAgainstMonthly(
  priceCents: number,
  interval: BillingInterval,
  intervalCount: number,
  monthlyPriceCents: number,
): { savingsCents: number; savingsPercent: number } | null {
  const months = intervalMonths(interval, intervalCount);
  if (months <= 1 || monthlyPriceCents <= 0) return null;
  const reference = Math.round(monthlyPriceCents * months);
  const savingsCents = reference - priceCents;
  if (savingsCents <= 0) return null;
  return {
    savingsCents,
    savingsPercent: Math.round((savingsCents / reference) * 100),
  };
}

export interface CouponLike {
  discountType: DiscountType;
  discountValue: number;
  minPurchaseCents: number;
  currency: string;
}

/** Applies a coupon to a price; never produces a negative total. */
export function applyDiscount(
  priceCents: number,
  coupon: CouponLike,
): { discountCents: number; finalPriceCents: number } {
  if (priceCents < coupon.minPurchaseCents) {
    return { discountCents: 0, finalPriceCents: priceCents };
  }
  const discountCents =
    coupon.discountType === 'PERCENTAGE'
      ? Math.round((priceCents * Math.min(100, Math.max(0, coupon.discountValue))) / 100)
      : Math.min(priceCents, Math.max(0, coupon.discountValue));
  return { discountCents, finalPriceCents: Math.max(0, priceCents - discountCents) };
}

/** Next renewal date for a subscription period. */
export function nextPeriodEnd(from: Date, interval: BillingInterval, intervalCount: number): Date {
  const next = new Date(from.getTime());
  switch (interval) {
    case 'DAY':
      next.setUTCDate(next.getUTCDate() + intervalCount);
      break;
    case 'WEEK':
      next.setUTCDate(next.getUTCDate() + intervalCount * 7);
      break;
    case 'MONTH':
      next.setUTCMonth(next.getUTCMonth() + intervalCount);
      break;
    case 'YEAR':
      next.setUTCFullYear(next.getUTCFullYear() + intervalCount);
      break;
    case 'ONE_TIME':
    default:
      next.setUTCMonth(next.getUTCMonth() + intervalCount);
      break;
  }
  return next;
}
