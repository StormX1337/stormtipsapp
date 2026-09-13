import type { ProductCode, SubscriptionStatus } from '@profit-tips/types';
import { ACCESS_GRANTING_STATUSES } from '@profit-tips/types';
import type { NormalizedSubscription } from './types.js';

/**
 * Pure entitlement rules shared by the API, the worker and the tests.
 * Anything stateful (database reads/writes) lives in the API's
 * `EntitlementService`; the decision logic itself lives here so it can be
 * unit-tested exhaustively.
 */

export interface EntitlementWindow {
  product: ProductCode;
  grantedAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

/** A subscription grants access while its status allows it and its period has not lapsed. */
export function subscriptionGrantsAccess(
  status: SubscriptionStatus,
  currentPeriodEnd: Date | null,
  gracePeriodEndsAt: Date | null = null,
  now: Date = new Date(),
): boolean {
  if (!ACCESS_GRANTING_STATUSES.includes(status)) return false;
  const effectiveEnd =
    gracePeriodEndsAt && currentPeriodEnd
      ? new Date(Math.max(gracePeriodEndsAt.getTime(), currentPeriodEnd.getTime()))
      : (gracePeriodEndsAt ?? currentPeriodEnd);
  if (!effectiveEnd) return status === 'ACTIVE' || status === 'TRIALING';
  return effectiveEnd.getTime() > now.getTime();
}

export function entitlementIsActive(window: EntitlementWindow, now: Date = new Date()): boolean {
  if (window.revokedAt && window.revokedAt.getTime() <= now.getTime()) return false;
  if (window.grantedAt.getTime() > now.getTime()) return false;
  if (!window.expiresAt) return true;
  return window.expiresAt.getTime() > now.getTime();
}

/** Collapses many entitlement rows into the set of products a user can access. */
export function activeProducts(
  windows: EntitlementWindow[],
  now: Date = new Date(),
): Set<ProductCode> {
  const products = new Set<ProductCode>(['FREE']);
  for (const window of windows) {
    if (entitlementIsActive(window, now)) products.add(window.product);
  }
  return products;
}

/** The date a subscription's access actually ends (period end or grace end). */
export function accessEndsAt(subscription: NormalizedSubscription): Date | null {
  const candidates = [subscription.currentPeriodEnd, subscription.gracePeriodEndsAt].filter(
    (value): value is Date => value instanceof Date,
  );
  if (candidates.length === 0) return null;
  return new Date(Math.max(...candidates.map((date) => date.getTime())));
}

export function daysRemaining(endsAt: Date | null, now: Date = new Date()): number | null {
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000));
}
