import { prisma } from '@profit-tips/database';
import {
  AppleAdapter,
  GoogleAdapter,
  StripeAdapter,
  applyDiscount,
  type NormalizedSubscription,
  type NormalizedWebhookEvent,
} from '@profit-tips/payments';
import {
  AppError,
  ErrorCode,
  type CouponPreviewDTO,
  type PaymentProvider,
  type ProductCode,
} from '@profit-tips/types';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';
import { entitlements } from './entitlement.service.js';

/**
 * Loads Apple's root certificates for JWS chain verification.
 * Apple publishes them at https://www.apple.com/certificateauthority/ — drop the
 * DER files into the directory named by APPLE_ROOT_CERTS_DIR.
 */
function loadAppleRootCertificates(): Buffer[] {
  const dir = process.env.APPLE_ROOT_CERTS_DIR;
  if (!dir) return [];
  try {
    return readdirSync(dir)
      .filter((file) => file.endsWith('.cer') || file.endsWith('.der'))
      .map((file) => readFileSync(path.join(dir, file)));
  } catch (error) {
    logger.warn({ err: error, dir }, 'could not load Apple root certificates');
    return [];
  }
}

export class BillingService {
  private stripeAdapter: StripeAdapter | null = null;
  private appleAdapter: AppleAdapter | null = null;
  private googleAdapter: GoogleAdapter | null = null;

  get stripe(): StripeAdapter {
    if (!env.STRIPE_SECRET_KEY) {
      throw new AppError(
        ErrorCode.PROVIDER_ERROR,
        'Card payments are not configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET — see docs/payments.md.',
      );
    }
    this.stripeAdapter ??= new StripeAdapter({
      secretKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? '',
    });
    return this.stripeAdapter;
  }

  get stripeConfigured(): boolean {
    return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
  }

  get apple(): AppleAdapter {
    this.appleAdapter ??= new AppleAdapter({
      bundleId: env.APPLE_BUNDLE_ID,
      issuerId: env.APPLE_ISSUER_ID ?? '',
      keyId: env.APPLE_KEY_ID ?? '',
      privateKey: env.APPLE_PRIVATE_KEY ?? '',
      environment: env.APPLE_ENVIRONMENT,
      rootCertificates: loadAppleRootCertificates(),
    });
    return this.appleAdapter;
  }

  get google(): GoogleAdapter {
    this.googleAdapter ??= new GoogleAdapter({
      packageName: env.GOOGLE_PLAY_PACKAGE_NAME,
      serviceAccountJsonBase64: env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64 ?? '',
      pubsubAudience: env.GOOGLE_PUBSUB_AUDIENCE,
      pubsubServiceAccountEmail: env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL,
    });
    return this.googleAdapter;
  }

  /** Resolves which products a vendor product identifier unlocks. */
  async productsForProviderId(
    provider: PaymentProvider,
    providerProductId: string | null,
  ): Promise<{ products: ProductCode[]; planId: string | null }> {
    if (!providerProductId) return { products: [], planId: null };
    const field =
      provider === 'STRIPE'
        ? 'stripePriceId'
        : provider === 'APPLE'
          ? 'appleProductId'
          : 'googleProductId';

    const plan = await prisma.subscriptionPlan.findFirst({
      where: { [field]: providerProductId },
    });
    if (plan) return { products: plan.products as ProductCode[], planId: plan.id };

    const fixPlan = await prisma.fixOddsPlan.findFirst({ where: { [field]: providerProductId } });
    if (fixPlan) return { products: ['FIX_ODDS'], planId: null };

    logger.warn({ provider, providerProductId }, 'no plan mapped to provider product id');
    return { products: [], planId: null };
  }

  /** Validates a coupon against a price and returns the resulting discount. */
  async previewCoupon(
    code: string,
    userId: string,
    priceCents: number,
    currency: string,
    products: ProductCode[],
    planId?: string,
  ): Promise<CouponPreviewDTO> {
    const invalid = (reason: string): CouponPreviewDTO => ({
      code,
      valid: false,
      reason,
      discountCents: 0,
      finalPriceCents: priceCents,
      currency,
    });

    const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
    if (!coupon || !coupon.isActive) return invalid('This code is not valid');
    const now = new Date();
    if (coupon.validFrom > now) return invalid('This code is not active yet');
    if (coupon.validUntil && coupon.validUntil < now) return invalid('This code has expired');
    if (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions) {
      return invalid('This code has reached its redemption limit');
    }
    if (priceCents < coupon.minPurchaseCents) {
      return invalid('This code requires a higher order value');
    }
    if (
      coupon.applicableProducts.length > 0 &&
      !products.some((product) => coupon.applicableProducts.includes(product))
    ) {
      return invalid('This code does not apply to the selected plan');
    }
    if (
      coupon.applicablePlanIds.length > 0 &&
      (!planId || !coupon.applicablePlanIds.includes(planId))
    ) {
      return invalid('This code does not apply to the selected plan');
    }

    const used = await prisma.couponRedemption.count({ where: { couponId: coupon.id, userId } });
    if (used >= coupon.maxRedemptionsPerUser) {
      return invalid('You have already used this code');
    }

    const { discountCents, finalPriceCents } = applyDiscount(priceCents, {
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minPurchaseCents: coupon.minPurchaseCents,
      currency: coupon.currency,
    });

    return { code: coupon.code, valid: true, discountCents, finalPriceCents, currency };
  }

  /**
   * Persists a normalised subscription and refreshes the derived entitlements.
   * Runs for every provider and is safe to call repeatedly with the same payload.
   */
  async upsertSubscription(
    normalized: NormalizedSubscription,
    fallbackUserId?: string,
  ): Promise<string | null> {
    const userId = await this.resolveUserId(normalized, fallbackUserId);
    if (!userId) {
      logger.error(
        { provider: normalized.provider, id: normalized.providerSubscriptionId },
        'could not attribute subscription to a user — skipping',
      );
      return null;
    }

    const { products, planId } = await this.productsForProviderId(
      normalized.provider,
      normalized.providerProductId,
    );

    const data = {
      userId,
      planId,
      provider: normalized.provider,
      providerSubscriptionId: normalized.providerSubscriptionId,
      providerCustomerId: normalized.providerCustomerId,
      providerStatus: normalized.providerStatus,
      status: normalized.status,
      products,
      startedAt: normalized.startedAt,
      currentPeriodStart: normalized.currentPeriodStart,
      currentPeriodEnd: normalized.currentPeriodEnd,
      trialEndsAt: normalized.trialEndsAt,
      gracePeriodEndsAt: normalized.gracePeriodEndsAt,
      cancelAtPeriodEnd: normalized.cancelAtPeriodEnd,
      canceledAt: normalized.canceledAt,
      endedAt: normalized.endedAt,
      priceCents: normalized.priceCents,
      currency: normalized.currency,
      raw: normalized.raw as never,
    };

    const subscription = await prisma.subscription.upsert({
      where: {
        provider_providerSubscriptionId: {
          provider: normalized.provider,
          providerSubscriptionId: normalized.providerSubscriptionId,
        },
      },
      create: data,
      update: data,
    });

    await entitlements.syncSubscription(subscription.id);
    return subscription.id;
  }

  private async resolveUserId(
    normalized: NormalizedSubscription,
    fallbackUserId?: string,
  ): Promise<string | null> {
    if (normalized.userRef) {
      const byRef = await prisma.user.findUnique({
        where: { id: normalized.userRef },
        select: { id: true },
      });
      if (byRef) return byRef.id;
    }
    if (fallbackUserId) return fallbackUserId;

    const existing = await prisma.subscription.findUnique({
      where: {
        provider_providerSubscriptionId: {
          provider: normalized.provider,
          providerSubscriptionId: normalized.providerSubscriptionId,
        },
      },
      select: { userId: true },
    });
    if (existing) return existing.userId;

    if (normalized.providerCustomerId) {
      const byCustomer = await prisma.subscription.findFirst({
        where: {
          provider: normalized.provider,
          providerCustomerId: normalized.providerCustomerId,
        },
        select: { userId: true },
      });
      if (byCustomer) return byCustomer.userId;
    }
    return null;
  }

  /**
   * Records an inbound webhook before processing it.
   * Returns `false` when the event has already been handled — the caller must
   * then acknowledge without doing any work (at-least-once delivery).
   */
  async claimWebhook(
    provider: PaymentProvider,
    eventId: string,
    type: string,
    payload: unknown,
  ): Promise<boolean> {
    try {
      await prisma.webhookEvent.create({
        data: {
          provider,
          eventId,
          type,
          payload: (payload ?? {}) as never,
          status: 'PROCESSING',
          attempts: 1,
        },
      });
      return true;
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        const existing = await prisma.webhookEvent.findUnique({
          where: { provider_eventId: { provider, eventId } },
        });
        if (existing?.status === 'FAILED') {
          await prisma.webhookEvent.update({
            where: { id: existing.id },
            data: { status: 'PROCESSING', attempts: { increment: 1 } },
          });
          return true;
        }
        logger.info({ provider, eventId }, 'duplicate webhook ignored');
        return false;
      }
      throw error;
    }
  }

  async completeWebhook(
    provider: PaymentProvider,
    eventId: string,
    status: 'PROCESSED' | 'FAILED' | 'IGNORED',
    error?: string,
  ): Promise<void> {
    await prisma.webhookEvent.update({
      where: { provider_eventId: { provider, eventId } },
      data: { status, error: error ?? null, processedAt: new Date() },
    });
  }

  /** Applies a verified webhook: subscription state first, then payment record. */
  async applyWebhook(envelope: NormalizedWebhookEvent): Promise<void> {
    if (envelope.subscription) {
      await this.upsertSubscription(envelope.subscription);
    }
    if (envelope.payment) {
      const payment = envelope.payment;
      const subscription = payment.providerSubscriptionId
        ? await prisma.subscription.findUnique({
            where: {
              provider_providerSubscriptionId: {
                provider: payment.provider,
                providerSubscriptionId: payment.providerSubscriptionId,
              },
            },
            select: { id: true, userId: true },
          })
        : null;

      const userId = payment.userRef ?? subscription?.userId;
      if (!userId) {
        logger.warn({ paymentId: payment.providerPaymentId }, 'payment without a resolvable user');
        return;
      }

      await prisma.payment.upsert({
        where: {
          provider_providerPaymentId: {
            provider: payment.provider,
            providerPaymentId: payment.providerPaymentId,
          },
        },
        create: {
          userId,
          subscriptionId: subscription?.id ?? null,
          provider: payment.provider,
          providerPaymentId: payment.providerPaymentId,
          providerStatus: payment.providerStatus,
          status: payment.status,
          amountCents: payment.amountCents,
          currency: payment.currency,
          description: payment.description,
          paidAt: payment.paidAt,
          raw: payment.raw as never,
        },
        update: {
          status: payment.status,
          providerStatus: payment.providerStatus,
          paidAt: payment.paidAt,
          raw: payment.raw as never,
        },
      });
    }
  }

  /** Verifies a mobile store purchase server-side and grants access. */
  async verifyStorePurchase(input: {
    provider: 'APPLE' | 'GOOGLE';
    receipt: string;
    productId: string;
    packageName?: string;
    userId: string;
  }): Promise<string> {
    const normalized =
      input.provider === 'APPLE'
        ? await this.apple.verifyTransaction(input.receipt)
        : await this.google.verifyPurchase(input.receipt, input.packageName);

    const subscriptionId = await this.upsertSubscription(normalized, input.userId);
    if (!subscriptionId) {
      throw new AppError(
        ErrorCode.PROVIDER_ERROR,
        'Purchase could not be attributed to your account',
      );
    }

    if (input.provider === 'GOOGLE') {
      try {
        await this.google.acknowledge(input.receipt, input.productId, input.packageName);
      } catch (error) {
        // Already-acknowledged purchases return an error we can safely ignore.
        logger.info({ err: error }, 'google acknowledge skipped');
      }
    }
    return subscriptionId;
  }
}

export const billing = new BillingService();
