import type { FastifyInstance } from 'fastify';
import { prisma } from '@storm-tips/database';
import { ALL_PRODUCTS, CACHE_TTL } from '@storm-tips/config';
import {
  AppError,
  ErrorCode,
  cancelSubscriptionSchema,
  checkoutSchema,
  validateCouponSchema,
  verifyStorePurchaseSchema,
  type ProductCode,
} from '@storm-tips/types';
import { parseBody } from '../lib/validate.js';
import { assertFound, noStore, publicCache } from '../lib/http.js';
import { env } from '../lib/env.js';
import { audit } from '../lib/audit.js';
import {
  serializeFixOddsPlan,
  serializePlan,
  serializeProduct,
  serializePromotion,
  serializeSubscription,
} from '../serializers/commerce.js';
import { billing } from '../services/billing.service.js';
import { entitlements } from '../services/entitlement.service.js';
import { statistics } from '../services/statistics.service.js';

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/products', async (_request, reply) => {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    publicCache(reply, CACHE_TTL.plans);
    return { items: products.map(serializeProduct) };
  });

  /**
   * Active plans.
   *
   * Every displayed number (per-month price, savings, badges) is computed here
   * from the database rows — the clients render, they never calculate.
   */
  app.get('/plans', { preHandler: [app.optionalAuth] }, async (request, reply) => {
    const locale = request.auth?.language ?? env.DEFAULT_LOCALE;
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { priceCents: 'asc' }],
    });

    // The "save X" line compares against the cheapest 1-month plan for the same products.
    const monthlyByProduct = new Map<string, number>();
    for (const plan of plans) {
      if (plan.interval !== 'MONTH' || plan.intervalCount !== 1) continue;
      const key = [...plan.products].sort().join('+');
      const current = monthlyByProduct.get(key);
      if (current === undefined || plan.priceCents < current) {
        monthlyByProduct.set(key, plan.priceCents);
      }
    }

    publicCache(reply, CACHE_TTL.plans);
    return {
      items: plans.map((plan) =>
        serializePlan(plan, locale, monthlyByProduct.get([...plan.products].sort().join('+'))),
      ),
      currency: env.DEFAULT_CURRENCY,
    };
  });

  app.get('/fix-odds-plans', { preHandler: [app.optionalAuth] }, async (request, reply) => {
    const plans = await prisma.fixOddsPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    publicCache(reply, CACHE_TTL.plans);
    return {
      items: plans.map((plan) => serializeFixOddsPlan(plan, request.auth?.language ?? 'de')),
    };
  });

  /** Paywall payload: plans, benefits and the verified headline statistics. */
  app.get('/paywall/:product', { preHandler: [app.optionalAuth] }, async (request, reply) => {
    const { product } = request.params as { product: string };
    const candidate = product.toUpperCase().replace('-', '_');
    if (!(ALL_PRODUCTS as readonly string[]).includes(candidate)) {
      throw AppError.notFound('Product');
    }
    const code = candidate as ProductCode;
    const locale = request.auth?.language ?? env.DEFAULT_LOCALE;

    const [productRow, plans, headline, promotions] = await Promise.all([
      prisma.product.findUnique({ where: { code } }),
      prisma.subscriptionPlan.findMany({
        where: { isActive: true, products: { has: code } },
        orderBy: [{ sortOrder: 'asc' }, { priceCents: 'asc' }],
      }),
      statistics.headline(code),
      prisma.promotion.findMany({
        where: {
          isActive: true,
          product: code,
          startsAt: { lte: new Date() },
          OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
        },
        orderBy: { priority: 'asc' },
        take: 3,
      }),
    ]);

    if (!productRow) throw AppError.notFound('Product');

    const monthly = plans.find((plan) => plan.interval === 'MONTH' && plan.intervalCount === 1);
    const unlocked = await entitlements.has(request.auth?.userId ?? null, code);

    publicCache(reply, 120);
    return {
      product: serializeProduct(productRow),
      unlocked,
      plans: plans.map((plan) => serializePlan(plan, locale, monthly?.priceCents)),
      promotions: promotions.map(serializePromotion),
      statistics: headline,
      legal: {
        minimumAge: 18,
        disclaimer:
          'STORM TIPS veröffentlicht Sportanalysen zu Informationszwecken. Alle Zahlen sind geprüfte historische Ergebnisse. Kein Ergebnis ist garantiert.',
      },
    };
  });

  app.get('/promotions', { preHandler: [app.optionalAuth] }, async (request, reply) => {
    const now = new Date();
    const promotions = await prisma.promotion.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        ...(request.auth?.language
          ? { OR: [{ locale: null }, { locale: request.auth.language }] }
          : {}),
      },
      orderBy: { priority: 'asc' },
      take: 10,
    });

    // Audience targeting happens server-side so the client cannot see offers meant for others.
    const products = await entitlements.productsFor(request.auth?.userId ?? null);
    const isSubscriber = products.size > 1;
    const filtered = promotions.filter((promotion) => {
      switch (promotion.audience) {
        case 'ANONYMOUS':
          return !request.auth;
        case 'FREE_USERS':
          return !isSubscriber;
        case 'SUBSCRIBERS':
        case 'EXPIRING_SUBSCRIBERS':
          return isSubscriber;
        default:
          return true;
      }
    });

    publicCache(reply, CACHE_TTL.promotions);
    return { items: filtered.map(serializePromotion) };
  });

  app.post('/coupons/validate', { preHandler: [app.authenticate] }, async (request, reply) => {
    const input = parseBody(request, validateCouponSchema);
    const plan = input.planId
      ? await prisma.subscriptionPlan.findUnique({ where: { id: input.planId } })
      : null;
    const fixPlan = input.fixOddsPlanId
      ? await prisma.fixOddsPlan.findUnique({ where: { id: input.fixOddsPlanId } })
      : null;
    if (!plan && !fixPlan) throw AppError.validation('A plan must be provided');

    const priceCents = plan?.priceCents ?? fixPlan!.priceCents;
    const currency = plan?.currency ?? fixPlan!.currency;
    const products = (plan?.products as ProductCode[]) ?? (['FIX_ODDS'] as ProductCode[]);

    noStore(reply);
    return billing.previewCoupon(
      input.code,
      request.auth!.userId,
      priceCents,
      currency,
      products,
      plan?.id,
    );
  });

  /** Card checkout (web). Mobile apps must use the store flows below. */
  app.post('/checkout', { preHandler: [app.authenticate] }, async (request, reply) => {
    const input = parseBody(request, checkoutSchema);
    if (!billing.stripeConfigured) {
      throw new AppError(
        ErrorCode.PROVIDER_ERROR,
        'Card payments are not configured on this environment. See docs/payments.md.',
      );
    }

    const plan = input.planId
      ? assertFound(
          await prisma.subscriptionPlan.findUnique({ where: { id: input.planId } }),
          'Plan',
        )
      : null;
    const fixPlan = input.fixOddsPlanId
      ? assertFound(
          await prisma.fixOddsPlan.findUnique({ where: { id: input.fixOddsPlanId } }),
          'Fix Odds plan',
        )
      : null;

    const priceId = plan?.stripePriceId ?? fixPlan?.stripePriceId;
    if (!priceId) {
      throw new AppError(
        ErrorCode.PROVIDER_ERROR,
        'This plan has no Stripe price configured. Set it in Admin → Plans.',
      );
    }
    if (plan && !plan.isActive) throw AppError.validation('This plan is no longer available');

    const session = await billing.stripe.createCheckoutSession({
      userId: request.auth!.userId,
      userEmail: request.auth!.email,
      planSlug: plan?.slug ?? fixPlan!.slug,
      providerPriceId: priceId,
      trialDays: plan?.trialDays ?? 0,
      couponCode: input.couponCode,
      successUrl: input.successUrl ?? env.STRIPE_SUCCESS_URL,
      cancelUrl: input.cancelUrl ?? env.STRIPE_CANCEL_URL,
      locale: request.auth!.language,
      metadata: { planId: plan?.id ?? '', fixOddsPlanId: fixPlan?.id ?? '' },
    });

    noStore(reply);
    return { checkoutUrl: session.url, sessionId: session.id, provider: 'STRIPE' };
  });

  app.post('/portal', { preHandler: [app.authenticate] }, async (request, reply) => {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: request.auth!.userId,
        provider: 'STRIPE',
        providerCustomerId: { not: null },
      },
      orderBy: { startedAt: 'desc' },
    });
    if (!subscription?.providerCustomerId) {
      throw AppError.notFound('Stripe customer');
    }
    const url = await billing.stripe.createBillingPortalSession(
      subscription.providerCustomerId,
      `${env.WEB_PUBLIC_URL}/account/subscription`,
    );
    noStore(reply);
    return { url };
  });

  /**
   * Mobile in-app purchase verification.
   * The server re-verifies the receipt with Apple/Google — a client claim alone
   * never grants access.
   */
  app.post('/purchases/verify', { preHandler: [app.authenticate] }, async (request, reply) => {
    const input = parseBody(request, verifyStorePurchaseSchema);
    const subscriptionId = await billing.verifyStorePurchase({
      provider: input.provider,
      receipt: input.receipt,
      productId: input.productId,
      packageName: input.packageName,
      userId: request.auth!.userId,
    });

    const subscription = await prisma.subscription.findUniqueOrThrow({
      where: { id: subscriptionId },
      include: { plan: true },
    });

    await audit(request, {
      action: 'purchase.verified',
      entityType: 'Subscription',
      entityId: subscriptionId,
      after: { provider: input.provider, productId: input.productId },
    });

    noStore(reply);
    return {
      subscription: serializeSubscription(subscription, request.auth!.language),
      entitlements: await entitlements.summary(request.auth!.userId),
    };
  });

  /** Restores purchases after a re-install or on a new device. */
  app.post('/purchases/restore', { preHandler: [app.authenticate] }, async (request, reply) => {
    const subscriptions = await prisma.subscription.findMany({
      where: { userId: request.auth!.userId },
      include: { plan: true },
    });
    for (const subscription of subscriptions) {
      await entitlements.syncSubscription(subscription.id);
    }
    noStore(reply);
    return {
      restored: subscriptions.length,
      subscriptions: subscriptions.map((subscription) =>
        serializeSubscription(subscription, request.auth!.language),
      ),
      entitlements: await entitlements.summary(request.auth!.userId),
    };
  });

  app.post('/subscriptions/cancel', { preHandler: [app.authenticate] }, async (request, reply) => {
    const input = parseBody(request, cancelSubscriptionSchema);
    const subscription = assertFound(
      await prisma.subscription.findFirst({
        where: { id: input.subscriptionId, userId: request.auth!.userId },
      }),
      'Subscription',
    );

    if (subscription.provider === 'STRIPE') {
      const updated = await billing.stripe.cancelSubscription(
        subscription.providerSubscriptionId,
        input.immediate,
      );
      await billing.upsertSubscription(updated, request.auth!.userId);
    } else {
      // Store subscriptions are cancelled in the App Store / Play Store itself.
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        subscription.provider === 'APPLE'
          ? 'Apple subscriptions must be cancelled in iOS Settings → Apple ID → Subscriptions.'
          : 'Google Play subscriptions must be cancelled in the Play Store.',
        { provider: subscription.provider },
      );
    }

    await audit(request, {
      action: 'subscription.cancelled',
      entityType: 'Subscription',
      entityId: subscription.id,
      after: { immediate: input.immediate, reason: input.reason },
    });

    noStore(reply);
    return { success: true };
  });
}
