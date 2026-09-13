import type { FastifyInstance } from 'fastify';
import { prisma, type Prisma } from '@profit-tips/database';
import {
  AppError,
  adminUsersQuerySchema,
  grantEntitlementSchema,
  idParamSchema,
  revokeEntitlementSchema,
  updateUserSchema,
} from '@profit-tips/types';
import { parseBody, parseParams, parseQuery } from '../../lib/validate.js';
import { assertFound, paginate, skipTake } from '../../lib/http.js';
import { audit } from '../../lib/audit.js';
import { serializeUser } from '../../serializers/user.js';
import { serializePayment, serializeSubscription } from '../../serializers/commerce.js';
import { entitlements } from '../../services/entitlement.service.js';

export async function adminUserRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', { preHandler: [app.requireCapability('users:read')] }, async (request) => {
    const query = parseQuery(request, adminUsersQuerySchema);
    const { skip, take } = skipTake(query);

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { displayName: { contains: query.search, mode: 'insensitive' } },
              { username: { contains: query.search, mode: 'insensitive' } },
              { referralCode: { equals: query.search.toUpperCase() } },
            ],
          }
        : {}),
      ...(query.product
        ? {
            entitlements: {
              some: {
                product: query.product,
                revokedAt: null,
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
              },
            },
          }
        : {}),
      ...(query.hasSubscription === true ? { subscriptions: { some: {} } } : {}),
      ...(query.hasSubscription === false ? { subscriptions: { none: {} } } : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortDir },
        skip,
        take,
        include: {
          _count: { select: { subscriptions: true, payments: true, referralsMade: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return paginate(
      users.map((user) => ({
        ...serializeUser(user),
        counts: user._count,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      })),
      total,
      query,
    );
  });

  app.get('/:id', { preHandler: [app.requireCapability('users:read')] }, async (request) => {
    const { id } = parseParams(request, idParamSchema);
    const user = assertFound(await prisma.user.findUnique({ where: { id } }), 'User');

    const [subscriptions, payments, sessions, referralCount] = await Promise.all([
      prisma.subscription.findMany({
        where: { userId: id },
        include: { plan: true },
        orderBy: { startedAt: 'desc' },
      }),
      prisma.payment.findMany({
        where: { userId: id },
        include: { invoice: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.session.findMany({
        where: { userId: id, revokedAt: null },
        select: { id: true, ip: true, userAgent: true, lastUsedAt: true, createdAt: true },
        orderBy: { lastUsedAt: 'desc' },
        take: 20,
      }),
      prisma.referral.count({ where: { referrerId: id } }),
    ]);

    return {
      user: serializeUser(user, await entitlements.summary(id)),
      subscriptions: subscriptions.map((subscription) => serializeSubscription(subscription)),
      payments: payments.map((payment) => serializePayment(payment)),
      sessions,
      referralCount,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      lastLoginIp: user.lastLoginIp,
    };
  });

  app.patch('/:id', { preHandler: [app.requireCapability('users:write')] }, async (request) => {
    const { id } = parseParams(request, idParamSchema);
    const input = parseBody(request, updateUserSchema);
    const before = assertFound(await prisma.user.findUnique({ where: { id } }), 'User');

    // Changing a role is a separate, higher privilege.
    if (input.role && input.role !== before.role && request.auth!.role !== 'SUPER_ADMIN') {
      throw AppError.forbidden('Only a super admin can change roles');
    }
    if (before.role === 'SUPER_ADMIN' && request.auth!.userId !== id && request.auth!.role !== 'SUPER_ADMIN') {
      throw AppError.forbidden('Super admin accounts can only be modified by a super admin');
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        role: input.role,
        status: input.status,
        displayName: input.displayName ?? undefined,
        banReason: input.banReason ?? undefined,
        bannedAt: input.status === 'BANNED' ? new Date() : input.status ? null : undefined,
      },
    });

    if (input.status === 'BANNED') {
      await prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'BANNED' },
      });
    }
    await entitlements.invalidate(id);
    await audit(request, {
      action: 'user.updated',
      entityType: 'User',
      entityId: id,
      before: { role: before.role, status: before.status },
      after: input,
    });
    return serializeUser(user, await entitlements.summary(id));
  });

  app.post('/:id/ban', { preHandler: [app.requireCapability('users:ban')] }, async (request) => {
    const { id } = parseParams(request, idParamSchema);
    const { banReason } = parseBody(request, updateUserSchema.pick({ banReason: true }));
    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: { status: 'BANNED', bannedAt: new Date(), banReason: banReason ?? null },
      }),
      prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'BANNED' },
      }),
    ]);
    await audit(request, { action: 'user.banned', entityType: 'User', entityId: id, after: { banReason } });
    return { success: true };
  });

  app.post('/:id/unban', { preHandler: [app.requireCapability('users:ban')] }, async (request) => {
    const { id } = parseParams(request, idParamSchema);
    await prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE', bannedAt: null, banReason: null },
    });
    await audit(request, { action: 'user.unbanned', entityType: 'User', entityId: id });
    return { success: true };
  });

  app.post(
    '/:id/entitlements',
    { preHandler: [app.requireCapability('entitlements:grant')] },
    async (request, reply) => {
      const { id } = parseParams(request, idParamSchema);
      const input = parseBody(request, grantEntitlementSchema);
      assertFound(await prisma.user.findUnique({ where: { id }, select: { id: true } }), 'User');

      const expiresAt = input.expiresAt
        ? new Date(input.expiresAt)
        : input.days
          ? new Date(Date.now() + input.days * 86_400_000)
          : null;

      await entitlements.grant(id, input.product, {
        expiresAt,
        source: input.source,
        grantedById: request.auth!.userId,
        note: input.note,
      });

      await audit(request, {
        action: 'entitlement.granted',
        entityType: 'User',
        entityId: id,
        after: { product: input.product, expiresAt },
      });
      reply.status(201);
      return { items: await entitlements.summary(id) };
    },
  );

  app.delete(
    '/:id/entitlements',
    { preHandler: [app.requireCapability('entitlements:grant')] },
    async (request) => {
      const { id } = parseParams(request, idParamSchema);
      const input = parseBody(request, revokeEntitlementSchema);
      const count = await entitlements.revoke(id, input.product, input.note);
      await audit(request, {
        action: 'entitlement.revoked',
        entityType: 'User',
        entityId: id,
        after: { product: input.product, count },
      });
      return { revoked: count, items: await entitlements.summary(id) };
    },
  );

  app.post('/:id/logout-all', { preHandler: [app.requireCapability('users:write')] }, async (request) => {
    const { id } = parseParams(request, idParamSchema);
    const { count } = await prisma.session.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'ADMIN_REVOKED' },
    });
    await audit(request, { action: 'user.sessions_revoked', entityType: 'User', entityId: id });
    return { revoked: count };
  });
}
