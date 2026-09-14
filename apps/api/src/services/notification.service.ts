import { prisma, type Prisma } from '@profit-tips/database';
import { PREFERENCE_FOR_TYPE } from '@profit-tips/notifications';
import type { NotificationType, ProductCode } from '@profit-tips/types';
import { jobs } from '../lib/queues.js';
import { mergePreferences } from '../serializers/user.js';

export interface AudienceFilter {
  products?: ProductCode[];
  userIds?: string[];
  onlyFreeUsers?: boolean;
  locale?: string;
}

/**
 * Creates notification rows and hands delivery to the worker.
 *
 * The API never talks to a push provider directly — it persists intent, the
 * worker performs delivery and records the outcome.
 */
export class NotificationService {
  /** Resolves an audience filter to the users who opted in to this type. */
  async resolveAudience(
    type: NotificationType,
    filter: AudienceFilter,
  ): Promise<{ id: string; language: string }[]> {
    const where: Prisma.UserWhereInput = {
      status: 'ACTIVE',
      deletedAt: null,
      ...(filter.userIds?.length ? { id: { in: filter.userIds } } : {}),
      ...(filter.locale ? { language: filter.locale } : {}),
      ...(filter.products?.length
        ? {
            entitlements: {
              some: {
                product: { in: filter.products },
                revokedAt: null,
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
              },
            },
          }
        : {}),
      ...(filter.onlyFreeUsers ? { entitlements: { none: { revokedAt: null } } } : {}),
    };

    const candidates = await prisma.user.findMany({
      where,
      select: { id: true, language: true, notificationPrefs: true },
      take: 50_000,
    });

    const preferenceKey = PREFERENCE_FOR_TYPE[type];
    return candidates
      .filter((user) => {
        const prefs = mergePreferences(user.notificationPrefs) as unknown as Record<
          string,
          boolean
        >;
        return prefs[preferenceKey] !== false;
      })
      .map((user) => ({ id: user.id, language: user.language }));
  }

  /** Queues a broadcast. `dedupeKey` prevents double fan-out on retries. */
  async broadcast(input: {
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    deepLink?: string | null;
    imageUrl?: string | null;
    audience: AudienceFilter;
    scheduledAt?: Date | null;
    dedupeKey?: string;
  }): Promise<void> {
    await jobs.fanOutNotification({
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data,
      deepLink: input.deepLink ?? null,
      imageUrl: input.imageUrl ?? null,
      audience: {
        products: input.audience.products,
        userIds: input.audience.userIds,
        onlyFreeUsers: input.audience.onlyFreeUsers,
        locale: input.audience.locale,
      },
      scheduledAt: input.scheduledAt?.toISOString() ?? null,
      dedupeKey: input.dedupeKey,
    });
  }

  /** Creates a single in-app notification and queues its push delivery. */
  async notifyUser(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    deepLink?: string | null;
  }): Promise<string> {
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: (input.data ?? {}) as never,
        deepLink: input.deepLink ?? null,
        status: 'PENDING',
      },
    });
    await jobs.sendNotification(notification.id);
    return notification.id;
  }
}

export const notifications = new NotificationService();
