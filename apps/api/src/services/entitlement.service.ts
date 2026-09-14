import { prisma } from '@storm-tips/database';
import { REDIS_KEYS } from '@storm-tips/config';
import { AppError, type EntitlementDTO, type ProductCode } from '@storm-tips/types';
import {
  activeProducts,
  entitlementIsActive,
  subscriptionGrantsAccess,
  type EntitlementWindow,
} from '@storm-tips/payments';
import { cacheDelete, cacheGet, cacheSet } from '../lib/cache.js';

const CACHE_TTL_SECONDS = 60;

interface CachedEntitlements {
  products: ProductCode[];
  details: EntitlementDTO[];
}

/**
 * The single source of truth for premium access.
 *
 * Every premium read path calls this; the client's claims are never trusted.
 * Results are cached for a minute and explicitly invalidated whenever a
 * subscription, entitlement or admin grant changes.
 */
export class EntitlementService {
  /** Loads (and caches) the products a user may access right now. */
  async load(userId: string): Promise<CachedEntitlements> {
    const key = REDIS_KEYS.entitlements(userId);
    const cached = await cacheGet<CachedEntitlements>(key);
    if (cached) return cached;

    const now = new Date();
    const [entitlements, subscriptions] = await Promise.all([
      prisma.entitlement.findMany({
        where: { userId, OR: [{ revokedAt: null }, { revokedAt: { gt: now } }] },
        select: {
          product: true,
          source: true,
          grantedAt: true,
          expiresAt: true,
          revokedAt: true,
        },
      }),
      prisma.subscription.findMany({
        where: { userId },
        select: {
          status: true,
          products: true,
          currentPeriodEnd: true,
          gracePeriodEndsAt: true,
        },
      }),
    ]);

    const windows: EntitlementWindow[] = entitlements.map((row) => ({
      product: row.product as ProductCode,
      grantedAt: row.grantedAt,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
    }));

    // A live subscription grants access even if the derived entitlement row is
    // momentarily stale (for example between a webhook and the sync job).
    for (const subscription of subscriptions) {
      if (
        !subscriptionGrantsAccess(
          subscription.status as never,
          subscription.currentPeriodEnd,
          subscription.gracePeriodEndsAt,
          now,
        )
      ) {
        continue;
      }
      for (const product of subscription.products) {
        windows.push({
          product: product as ProductCode,
          grantedAt: new Date(0),
          expiresAt: subscription.gracePeriodEndsAt ?? subscription.currentPeriodEnd,
          revokedAt: null,
        });
      }
    }

    const products = [...activeProducts(windows, now)];
    const details: EntitlementDTO[] = entitlements.map((row) => ({
      product: row.product as ProductCode,
      active: entitlementIsActive(
        {
          product: row.product as ProductCode,
          grantedAt: row.grantedAt,
          expiresAt: row.expiresAt,
          revokedAt: row.revokedAt,
        },
        now,
      ),
      source: row.source,
      expiresAt: row.expiresAt?.toISOString() ?? null,
    }));

    const payload: CachedEntitlements = { products, details };
    await cacheSet(key, payload, CACHE_TTL_SECONDS);
    return payload;
  }

  async productsFor(userId: string | null | undefined): Promise<Set<ProductCode>> {
    if (!userId) return new Set<ProductCode>(['FREE']);
    const { products } = await this.load(userId);
    return new Set(products);
  }

  async has(userId: string | null | undefined, product: ProductCode): Promise<boolean> {
    if (product === 'FREE') return true;
    if (!userId) return false;
    const products = await this.productsFor(userId);
    return products.has(product);
  }

  async require(userId: string | null | undefined, product: ProductCode): Promise<void> {
    if (!(await this.has(userId, product))) {
      throw AppError.entitlementRequired(product);
    }
  }

  async summary(userId: string): Promise<EntitlementDTO[]> {
    const { details } = await this.load(userId);
    return details;
  }

  async invalidate(userId: string): Promise<void> {
    await cacheDelete(REDIS_KEYS.entitlements(userId));
  }

  /**
   * Rebuilds the derived entitlement rows for one subscription.
   * Idempotent: repeated calls converge on the same rows.
   */
  async syncSubscription(subscriptionId: string): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: {
        id: true,
        userId: true,
        products: true,
        status: true,
        currentPeriodEnd: true,
        gracePeriodEndsAt: true,
      },
    });
    if (!subscription) return;

    const now = new Date();
    const grants = subscriptionGrantsAccess(
      subscription.status as never,
      subscription.currentPeriodEnd,
      subscription.gracePeriodEndsAt,
      now,
    );
    const expiresAt = subscription.gracePeriodEndsAt ?? subscription.currentPeriodEnd;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.entitlement.findMany({
        where: { subscriptionId: subscription.id },
      });

      for (const product of subscription.products) {
        const row = existing.find((entry) => entry.product === product);
        if (row) {
          await tx.entitlement.update({
            where: { id: row.id },
            data: { expiresAt, revokedAt: grants ? null : (row.revokedAt ?? now) },
          });
        } else if (grants) {
          await tx.entitlement.create({
            data: {
              userId: subscription.userId,
              product,
              source: 'SUBSCRIPTION',
              subscriptionId: subscription.id,
              expiresAt,
            },
          });
        }
      }

      // Products removed from the plan lose their entitlement.
      for (const row of existing) {
        if (!subscription.products.includes(row.product)) {
          await tx.entitlement.update({
            where: { id: row.id },
            data: { revokedAt: row.revokedAt ?? now },
          });
        }
      }
    });

    await this.invalidate(subscription.userId);
  }

  async grant(
    userId: string,
    product: ProductCode,
    options: { expiresAt?: Date | null; source?: string; grantedById?: string; note?: string } = {},
  ): Promise<void> {
    await prisma.entitlement.create({
      data: {
        userId,
        product,
        source: (options.source as never) ?? 'ADMIN_GRANT',
        expiresAt: options.expiresAt ?? null,
        grantedById: options.grantedById ?? null,
        note: options.note ?? null,
      },
    });
    await this.invalidate(userId);
  }

  async revoke(userId: string, product: ProductCode, note?: string): Promise<number> {
    const now = new Date();
    const { count } = await prisma.entitlement.updateMany({
      where: { userId, product, revokedAt: null },
      data: { revokedAt: now, note: note ?? null },
    });
    await this.invalidate(userId);
    return count;
  }
}

export const entitlements = new EntitlementService();
