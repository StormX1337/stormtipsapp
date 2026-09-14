import type { FastifyInstance } from 'fastify';
import { prisma } from '@storm-tips/database';
import {
  idParamSchema,
  paginationSchema,
  registerDeviceSchema,
  updateProfileSchema,
} from '@storm-tips/types';
import { parseBody, parseParams, parseQuery } from '../lib/validate.js';
import { noStore, paginate, skipTake } from '../lib/http.js';
import { serializeNotification, serializeUser } from '../serializers/user.js';
import { serializePayment, serializeSubscription } from '../serializers/commerce.js';
import { entitlements } from '../services/entitlement.service.js';
import { referrals } from '../services/referral.service.js';

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);
  app.addHook('onSend', async (_request, reply, payload) => {
    noStore(reply);
    return payload;
  });

  app.get('/', async (request) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.auth!.userId } });
    return serializeUser(user, await entitlements.summary(user.id));
  });

  app.patch('/', async (request) => {
    const input = parseBody(request, updateProfileSchema);
    const userId = request.auth!.userId;

    const current = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        displayName: input.displayName ?? undefined,
        username: input.username ?? undefined,
        avatarUrl: input.avatarUrl ?? undefined,
        countryCode: input.countryCode ?? undefined,
        language: input.language,
        timezone: input.timezone,
        currency: input.currency,
        marketingOptIn: input.marketingOptIn,
        favoriteLeagueIds: input.favoriteLeagueIds,
        favoriteTeamIds: input.favoriteTeamIds,
        notificationPrefs: input.notificationPrefs
          ? ({
              ...(current.notificationPrefs as Record<string, boolean>),
              ...input.notificationPrefs,
            } as never)
          : undefined,
      },
    });
    return serializeUser(user, await entitlements.summary(user.id));
  });

  /** Soft delete: the account is anonymised and every session revoked. */
  app.delete('/', async (request) => {
    const userId = request.auth!.userId;
    const anonymised = `deleted+${userId}@stormtips.invalid`;
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          status: 'DELETED',
          email: anonymised,
          displayName: 'Deleted user',
          username: null,
          avatarUrl: null,
          passwordHash: null,
          googleId: null,
          appleId: null,
          lastLoginIp: null,
        },
      }),
      prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'ACCOUNT_DELETED' },
      }),
      prisma.deviceToken.updateMany({ where: { userId }, data: { isActive: false } }),
    ]);
    await entitlements.invalidate(userId);
    return { success: true };
  });

  app.get('/entitlements', async (request) => ({
    items: await entitlements.summary(request.auth!.userId),
  }));

  app.get('/subscriptions', async (request) => {
    const subscriptions = await prisma.subscription.findMany({
      where: { userId: request.auth!.userId },
      include: { plan: true },
      orderBy: { startedAt: 'desc' },
    });
    return {
      items: subscriptions.map((subscription) =>
        serializeSubscription(subscription, request.locale),
      ),
    };
  });

  app.get('/payments', async (request) => {
    const query = parseQuery(request, paginationSchema);
    const { skip, take } = skipTake(query);
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: { userId: request.auth!.userId },
        include: { invoice: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.payment.count({ where: { userId: request.auth!.userId } }),
    ]);
    return paginate(
      payments.map((payment) => serializePayment(payment, request.locale)),
      total,
      query,
    );
  });

  app.get('/notifications', async (request) => {
    const query = parseQuery(request, paginationSchema);
    const { skip, take } = skipTake(query);
    const where = { userId: request.auth!.userId };
    const [items, total, unread] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return { ...paginate(items.map(serializeNotification), total, query), unread };
  });

  app.post('/notifications/:id/read', async (request) => {
    const { id } = parseParams(request, idParamSchema);
    await prisma.notification.updateMany({
      where: { id, userId: request.auth!.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  });

  app.post('/notifications/read-all', async (request) => {
    const { count } = await prisma.notification.updateMany({
      where: { userId: request.auth!.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true, count };
  });

  /** Registers (or refreshes) a push token for this device. */
  app.post('/devices', async (request, reply) => {
    const input = parseBody(request, registerDeviceSchema);
    const userId = request.auth!.userId;
    await prisma.deviceToken.upsert({
      where: { token: input.token },
      create: {
        userId,
        token: input.token,
        provider: input.provider,
        platform: input.platform,
        deviceId: input.deviceId ?? null,
        deviceName: input.deviceName ?? null,
        appVersion: input.appVersion ?? null,
        locale: input.locale ?? null,
      },
      update: {
        userId,
        isActive: true,
        lastSeenAt: new Date(),
        appVersion: input.appVersion ?? null,
        locale: input.locale ?? null,
      },
    });
    reply.status(201);
    return { success: true };
  });

  app.delete('/devices/:token', async (request) => {
    const { token } = request.params as { token: string };
    await prisma.deviceToken.updateMany({
      where: { token, userId: request.auth!.userId },
      data: { isActive: false },
    });
    return { success: true };
  });

  app.get('/referrals', async (request) => referrals.summary(request.auth!.userId, request.locale));

  app.get('/referrals/list', async (request) => ({
    items: await referrals.list(request.auth!.userId),
  }));
}
