import type { FastifyInstance } from 'fastify';
import { prisma, type Prisma } from '@storm-tips/database';
import {
  AppError,
  idParamSchema,
  paginationSchema,
  upsertCouponSchema,
  upsertFixOddsPlanSchema,
  upsertPlanSchema,
  upsertPromotionSchema,
} from '@storm-tips/types';
import { parseBody, parseParams, parseQuery } from '../../lib/validate.js';
import { assertFound, paginate, skipTake } from '../../lib/http.js';
import { audit } from '../../lib/audit.js';
import { cacheInvalidatePattern } from '../../lib/cache.js';
import {
  serializeFixOddsPlan,
  serializePayment,
  serializePlan,
  serializePromotion,
  serializeSubscription,
} from '../../serializers/commerce.js';

export async function adminCommerceRoutes(app: FastifyInstance): Promise<void> {
  // ── subscription plans ────────────────────────────────────────────────────
  app.get('/plans', { preHandler: [app.requireCapability('plans:write')] }, async () => {
    const plans = await prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: 'asc' } });
    return { items: plans.map((plan) => serializePlan(plan)) };
  });

  app.post(
    '/plans',
    { preHandler: [app.requireCapability('plans:write')] },
    async (request, reply) => {
      const input = parseBody(request, upsertPlanSchema);
      const plan = await prisma.subscriptionPlan.create({ data: normalisePlan(input) });
      await cacheInvalidatePattern('plans:*');
      await audit(request, {
        action: 'plan.created',
        entityType: 'SubscriptionPlan',
        entityId: plan.id,
        after: input,
      });
      reply.status(201);
      return serializePlan(plan);
    },
  );

  app.patch(
    '/plans/:id',
    { preHandler: [app.requireCapability('plans:write')] },
    async (request) => {
      const { id } = parseParams(request, idParamSchema);
      const input = parseBody(request, upsertPlanSchema.partial());
      const before = assertFound(
        await prisma.subscriptionPlan.findUnique({ where: { id } }),
        'Plan',
      );
      const plan = await prisma.subscriptionPlan.update({
        where: { id },
        data: {
          ...(normalisePlan(input as never, true) as Record<string, unknown>),
        } as never,
      });
      await cacheInvalidatePattern('plans:*');
      await audit(request, {
        action: 'plan.updated',
        entityType: 'SubscriptionPlan',
        entityId: id,
        before,
        after: input,
      });
      return serializePlan(plan);
    },
  );

  app.delete(
    '/plans/:id',
    { preHandler: [app.requireCapability('plans:write')] },
    async (request) => {
      const { id } = parseParams(request, idParamSchema);
      const inUse = await prisma.subscription.count({ where: { planId: id } });
      if (inUse > 0) {
        // Never delete a plan people are paying for — deactivate it instead.
        await prisma.subscriptionPlan.update({ where: { id }, data: { isActive: false } });
        await audit(request, {
          action: 'plan.deactivated',
          entityType: 'SubscriptionPlan',
          entityId: id,
        });
        return { success: true, deactivated: true, activeSubscriptions: inUse };
      }
      await prisma.subscriptionPlan.delete({ where: { id } });
      await cacheInvalidatePattern('plans:*');
      await audit(request, {
        action: 'plan.deleted',
        entityType: 'SubscriptionPlan',
        entityId: id,
      });
      return { success: true, deactivated: false };
    },
  );

  // ── fix odds plans ────────────────────────────────────────────────────────
  app.get('/fix-odds-plans', { preHandler: [app.requireCapability('plans:write')] }, async () => {
    const plans = await prisma.fixOddsPlan.findMany({ orderBy: { sortOrder: 'asc' } });
    return { items: plans.map((plan) => serializeFixOddsPlan(plan)) };
  });

  app.post(
    '/fix-odds-plans',
    { preHandler: [app.requireCapability('plans:write')] },
    async (request, reply) => {
      const input = parseBody(request, upsertFixOddsPlanSchema);
      if (input.maxOdds < input.targetOdds) {
        throw AppError.validation('maxOdds must be greater than or equal to targetOdds');
      }
      const plan = await prisma.fixOddsPlan.create({ data: input as never });
      await audit(request, {
        action: 'fixodds.created',
        entityType: 'FixOddsPlan',
        entityId: plan.id,
        after: input,
      });
      reply.status(201);
      return serializeFixOddsPlan(plan);
    },
  );

  app.patch(
    '/fix-odds-plans/:id',
    { preHandler: [app.requireCapability('plans:write')] },
    async (request) => {
      const { id } = parseParams(request, idParamSchema);
      const input = parseBody(request, upsertFixOddsPlanSchema.partial());
      const before = assertFound(
        await prisma.fixOddsPlan.findUnique({ where: { id } }),
        'Fix odds plan',
      );
      const plan = await prisma.fixOddsPlan.update({
        where: { id },
        data: {
          ...(input as Record<string, unknown>),
        } as never,
      });
      await audit(request, {
        action: 'fixodds.updated',
        entityType: 'FixOddsPlan',
        entityId: id,
        before,
        after: input,
      });
      return serializeFixOddsPlan(plan);
    },
  );

  app.delete(
    '/fix-odds-plans/:id',
    { preHandler: [app.requireCapability('plans:write')] },
    async (request) => {
      const { id } = parseParams(request, idParamSchema);
      await prisma.fixOddsPlan.update({ where: { id }, data: { isActive: false } });
      await audit(request, {
        action: 'fixodds.deactivated',
        entityType: 'FixOddsPlan',
        entityId: id,
      });
      return { success: true };
    },
  );

  // ── coupons ───────────────────────────────────────────────────────────────
  app.get('/coupons', { preHandler: [app.requireCapability('coupons:write')] }, async (request) => {
    const query = parseQuery(request, paginationSchema);
    const { skip, take } = skipTake(query);
    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({ orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.coupon.count(),
    ]);
    return paginate(
      coupons.map((coupon) => coupon),
      total,
      query,
    );
  });

  app.post(
    '/coupons',
    { preHandler: [app.requireCapability('coupons:write')] },
    async (request, reply) => {
      const input = parseBody(request, upsertCouponSchema);
      if (input.discountType === 'PERCENTAGE' && input.discountValue > 100) {
        throw AppError.validation('A percentage discount cannot exceed 100');
      }
      const coupon = await prisma.coupon.create({
        data: {
          ...input,
          code: input.code.toUpperCase(),
          validFrom: input.validFrom ? new Date(input.validFrom) : new Date(),
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
        } as never,
      });
      await audit(request, {
        action: 'coupon.created',
        entityType: 'Coupon',
        entityId: coupon.id,
        after: input,
      });
      reply.status(201);
      return coupon;
    },
  );

  app.patch(
    '/coupons/:id',
    { preHandler: [app.requireCapability('coupons:write')] },
    async (request) => {
      const { id } = parseParams(request, idParamSchema);
      const input = parseBody(request, upsertCouponSchema.partial());
      const before = assertFound(await prisma.coupon.findUnique({ where: { id } }), 'Coupon');
      const coupon = await prisma.coupon.update({
        where: { id },
        data: {
          ...input,
          code: input.code?.toUpperCase(),
          validFrom: input.validFrom ? new Date(input.validFrom) : undefined,
          validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
        } as never,
      });
      await audit(request, {
        action: 'coupon.updated',
        entityType: 'Coupon',
        entityId: id,
        before,
        after: input,
      });
      return coupon;
    },
  );

  app.delete(
    '/coupons/:id',
    { preHandler: [app.requireCapability('coupons:write')] },
    async (request) => {
      const { id } = parseParams(request, idParamSchema);
      await prisma.coupon.update({ where: { id }, data: { isActive: false } });
      await audit(request, { action: 'coupon.deactivated', entityType: 'Coupon', entityId: id });
      return { success: true };
    },
  );

  app.get(
    '/coupons/:id/redemptions',
    { preHandler: [app.requireCapability('coupons:write')] },
    async (request) => {
      const { id } = parseParams(request, idParamSchema);
      const redemptions = await prisma.couponRedemption.findMany({
        where: { couponId: id },
        include: { user: { select: { email: true } } },
        orderBy: { redeemedAt: 'desc' },
        take: 200,
      });
      return { items: redemptions };
    },
  );

  // ── promotions ────────────────────────────────────────────────────────────
  app.get('/promotions', { preHandler: [app.requireCapability('promotions:write')] }, async () => {
    const promotions = await prisma.promotion.findMany({ orderBy: { priority: 'asc' } });
    return {
      items: promotions.map((promotion) => serializePromotion(promotion)),
    };
  });

  app.post(
    '/promotions',
    { preHandler: [app.requireCapability('promotions:write')] },
    async (request, reply) => {
      const input = parseBody(request, upsertPromotionSchema);
      const promotion = await prisma.promotion.create({
        data: {
          ...input,
          startsAt: input.startsAt ? new Date(input.startsAt) : new Date(),
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
        } as never,
      });
      await cacheInvalidatePattern('promotions:*');
      await audit(request, {
        action: 'promotion.created',
        entityType: 'Promotion',
        entityId: promotion.id,
        after: input,
      });
      reply.status(201);
      return serializePromotion(promotion);
    },
  );

  app.patch(
    '/promotions/:id',
    { preHandler: [app.requireCapability('promotions:write')] },
    async (request) => {
      const { id } = parseParams(request, idParamSchema);
      const input = parseBody(request, upsertPromotionSchema.partial());
      const before = assertFound(await prisma.promotion.findUnique({ where: { id } }), 'Promotion');
      const promotion = await prisma.promotion.update({
        where: { id },
        data: {
          ...input,
          startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
          endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
        } as never,
      });
      await cacheInvalidatePattern('promotions:*');
      await audit(request, {
        action: 'promotion.updated',
        entityType: 'Promotion',
        entityId: id,
        before,
        after: input,
      });
      return serializePromotion(promotion);
    },
  );

  app.delete(
    '/promotions/:id',
    { preHandler: [app.requireCapability('promotions:write')] },
    async (request) => {
      const { id } = parseParams(request, idParamSchema);
      await prisma.promotion.delete({ where: { id } });
      await cacheInvalidatePattern('promotions:*');
      await audit(request, { action: 'promotion.deleted', entityType: 'Promotion', entityId: id });
      return { success: true };
    },
  );

  // ── payments & subscriptions ──────────────────────────────────────────────
  app.get(
    '/payments',
    { preHandler: [app.requireCapability('payments:read')] },
    async (request) => {
      const query = parseQuery(request, paginationSchema);
      const { skip, take } = skipTake(query);
      const [payments, total, aggregate] = await Promise.all([
        prisma.payment.findMany({
          include: { invoice: true, user: { select: { email: true } } },
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        prisma.payment.count(),
        prisma.payment.aggregate({ where: { status: 'SUCCEEDED' }, _sum: { amountCents: true } }),
      ]);
      return {
        ...paginate(
          payments.map((payment) => ({
            ...serializePayment(payment),
            userEmail: payment.user.email,
          })),
          total,
          query,
        ),
        totalRevenueCents: aggregate._sum.amountCents ?? 0,
      };
    },
  );

  app.get(
    '/subscriptions',
    { preHandler: [app.requireCapability('payments:read')] },
    async (request) => {
      const query = parseQuery(request, paginationSchema);
      const { skip, take } = skipTake(query);
      const [subscriptions, total] = await Promise.all([
        prisma.subscription.findMany({
          include: { plan: true, user: { select: { email: true } } },
          orderBy: { startedAt: 'desc' },
          skip,
          take,
        }),
        prisma.subscription.count(),
      ]);
      return paginate(
        subscriptions.map((subscription) => ({
          ...serializeSubscription(subscription),
          userEmail: subscription.user.email,
        })),
        total,
        query,
      );
    },
  );

  app.get(
    '/webhooks',
    { preHandler: [app.requireCapability('payments:read')] },
    async (request) => {
      const query = parseQuery(request, paginationSchema);
      const { skip, take } = skipTake(query);
      const where: Prisma.WebhookEventWhereInput = {};
      const [events, total] = await Promise.all([
        prisma.webhookEvent.findMany({
          where,
          orderBy: { receivedAt: 'desc' },
          skip,
          take,
          select: {
            id: true,
            provider: true,
            eventId: true,
            type: true,
            status: true,
            error: true,
            attempts: true,
            receivedAt: true,
            processedAt: true,
          },
        }),
        prisma.webhookEvent.count({ where }),
      ]);
      return paginate(events, total, query);
    },
  );
}

function normalisePlan(input: Record<string, unknown>, partial = false): never {
  const data: Record<string, unknown> = { ...input };
  if (!partial) {
    data.currency ??= 'EUR';
  }
  return data as never;
}
