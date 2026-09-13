import { describe, expect, it } from 'vitest';
import {
  accessEndsAt,
  activeProducts,
  applyDiscount,
  daysRemaining,
  entitlementIsActive,
  intervalMonths,
  nextPeriodEnd,
  pricePerMonthCents,
  savingsAgainstMonthly,
  subscriptionGrantsAccess,
  type NormalizedSubscription,
} from '../src/index.js';

const now = new Date('2026-09-13T12:00:00.000Z');
const future = new Date('2026-10-13T12:00:00.000Z');
const past = new Date('2026-08-13T12:00:00.000Z');

describe('subscriptionGrantsAccess', () => {
  it('grants access while an active period is running', () => {
    expect(subscriptionGrantsAccess('ACTIVE', future, null, now)).toBe(true);
    expect(subscriptionGrantsAccess('TRIALING', future, null, now)).toBe(true);
  });

  it('keeps access for a cancelled subscription until the paid period ends', () => {
    expect(subscriptionGrantsAccess('CANCELED', future, null, now)).toBe(true);
    expect(subscriptionGrantsAccess('CANCELED', past, null, now)).toBe(false);
  });

  it('honours a grace period that outlives the billing period', () => {
    expect(subscriptionGrantsAccess('GRACE_PERIOD', past, future, now)).toBe(true);
    expect(subscriptionGrantsAccess('PAST_DUE', past, null, now)).toBe(false);
  });

  it('never grants access for expired or incomplete subscriptions', () => {
    expect(subscriptionGrantsAccess('EXPIRED', future, null, now)).toBe(false);
    expect(subscriptionGrantsAccess('INCOMPLETE', future, null, now)).toBe(false);
    expect(subscriptionGrantsAccess('PAUSED', future, null, now)).toBe(false);
  });
});

describe('entitlements', () => {
  it('treats an open-ended entitlement as active', () => {
    expect(
      entitlementIsActive({ product: 'VIP', grantedAt: past, expiresAt: null, revokedAt: null }, now),
    ).toBe(true);
  });

  it('respects expiry and revocation', () => {
    expect(
      entitlementIsActive({ product: 'VIP', grantedAt: past, expiresAt: past, revokedAt: null }, now),
    ).toBe(false);
    expect(
      entitlementIsActive({ product: 'VIP', grantedAt: past, expiresAt: future, revokedAt: past }, now),
    ).toBe(false);
  });

  it('ignores entitlements that start in the future', () => {
    expect(
      entitlementIsActive({ product: 'VIP', grantedAt: future, expiresAt: null, revokedAt: null }, now),
    ).toBe(false);
  });

  it('always includes FREE and collapses active rows', () => {
    const products = activeProducts(
      [
        { product: 'VIP', grantedAt: past, expiresAt: future, revokedAt: null },
        { product: 'COMBO', grantedAt: past, expiresAt: past, revokedAt: null },
        { product: 'EXTRA', grantedAt: past, expiresAt: null, revokedAt: null },
      ],
      now,
    );
    expect([...products].sort()).toEqual(['EXTRA', 'FREE', 'VIP']);
  });

  it('takes the later of period end and grace end', () => {
    const subscription = {
      currentPeriodEnd: past,
      gracePeriodEndsAt: future,
    } as NormalizedSubscription;
    expect(accessEndsAt(subscription)?.toISOString()).toBe(future.toISOString());
    expect(daysRemaining(future, now)).toBe(30);
    expect(daysRemaining(null)).toBeNull();
    expect(daysRemaining(past, now)).toBe(0);
  });
});

describe('pricing', () => {
  it('converts billing intervals to months', () => {
    expect(intervalMonths('MONTH', 1)).toBe(1);
    expect(intervalMonths('MONTH', 6)).toBe(6);
    expect(intervalMonths('YEAR', 1)).toBe(12);
  });

  it('computes the per-month price only for multi-month plans', () => {
    // 3 months at 79.99 € → 26.66 €/month, exactly like the reference screenshot
    expect(pricePerMonthCents(7999, 'MONTH', 3)).toBe(2666);
    // 6 months at 139.99 € → 23.33 €/month
    expect(pricePerMonthCents(13999, 'MONTH', 6)).toBe(2333);
    expect(pricePerMonthCents(2999, 'MONTH', 1)).toBeNull();
  });

  it('computes savings against the reference monthly price', () => {
    const savings = savingsAgainstMonthly(7999, 'MONTH', 3, 2999);
    expect(savings?.savingsCents).toBe(998);
    expect(savings?.savingsPercent).toBe(11);
    expect(savingsAgainstMonthly(2999, 'MONTH', 1, 2999)).toBeNull();
  });

  it('applies percentage and fixed coupons without going negative', () => {
    expect(
      applyDiscount(2999, { discountType: 'PERCENTAGE', discountValue: 20, minPurchaseCents: 0, currency: 'EUR' }),
    ).toEqual({ discountCents: 600, finalPriceCents: 2399 });
    expect(
      applyDiscount(2999, { discountType: 'FIXED', discountValue: 5000, minPurchaseCents: 0, currency: 'EUR' }),
    ).toEqual({ discountCents: 2999, finalPriceCents: 0 });
  });

  it('ignores a coupon below its minimum purchase', () => {
    expect(
      applyDiscount(1000, { discountType: 'PERCENTAGE', discountValue: 20, minPurchaseCents: 2000, currency: 'EUR' }),
    ).toEqual({ discountCents: 0, finalPriceCents: 1000 });
  });

  it('advances the period end by the billing interval', () => {
    expect(nextPeriodEnd(new Date('2026-01-31T00:00:00Z'), 'MONTH', 1).toISOString()).toBe(
      '2026-03-03T00:00:00.000Z',
    );
    expect(nextPeriodEnd(new Date('2026-09-13T00:00:00Z'), 'YEAR', 1).toISOString()).toBe(
      '2027-09-13T00:00:00.000Z',
    );
    expect(nextPeriodEnd(new Date('2026-09-13T00:00:00Z'), 'WEEK', 2).toISOString()).toBe(
      '2026-09-27T00:00:00.000Z',
    );
  });
});
