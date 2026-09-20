import { prisma, type Prisma } from '@storm-tips/database';
import { PREFERENCE_FOR_TYPE, renderTemplate, type TemplateKey } from '@storm-tips/notifications';
import type { NotificationType, ProductCode } from '@storm-tips/types';
import { jobs } from '../lib/queues.js';
import { mergePreferences } from '../serializers/user.js';

export interface AudienceFilter {
  products?: ProductCode[];
  userIds?: string[];
  onlyFreeUsers?: boolean;
  /**
   * What this notification is about, so readers who asked to hear only about
   * their favourites can be left out of the rest.
   *
   * Absent — a subscription reminder, a promotion — nobody is filtered: those
   * are about the account, not about a match.
   */
  about?: { leagueId?: string | null; teamIds?: string[] };
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
      select: {
        id: true,
        language: true,
        notificationPrefs: true,
        favoriteLeagueIds: true,
        favoriteTeamIds: true,
      },
      take: 50_000,
    });

    const preferenceKey = PREFERENCE_FOR_TYPE[type];
    const about = filter.about;

    return candidates
      .filter((user) => {
        const prefs = mergePreferences(user.notificationPrefs) as unknown as Record<
          string,
          boolean
        >;
        if (prefs[preferenceKey] === false) return false;
        if (!about || prefs.onlyFavourites !== true) return true;

        // "Only my favourites" with nothing marked would mean silence, which is
        // never what someone meant by it; it takes effect once there is a
        // favourite to compare against.
        const leagues = user.favoriteLeagueIds;
        const teams = user.favoriteTeamIds;
        if (leagues.length === 0 && teams.length === 0) return true;

        if (about.leagueId && leagues.includes(about.leagueId)) return true;
        return (about.teamIds ?? []).some((teamId) => teams.includes(teamId));
      })
      .map((user) => ({ id: user.id, language: user.language }));
  }

  /**
   * Queues a broadcast. `dedupeKey` prevents double fan-out on retries.
   *
   * Pass `values` to render the shared template, or `title`/`body` for text an
   * operator composed.
   */
  async broadcast(input: {
    type: NotificationType;
    /** Template to render, when it differs from the stored notification type. */
    templateKey?: TemplateKey;
    /** Placeholder values for the template. */
    values?: Record<string, string | number>;
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
    deepLink?: string | null;
    imageUrl?: string | null;
    audience: AudienceFilter;
    scheduledAt?: Date | null;
    dedupeKey?: string;
  }): Promise<void> {
    await jobs.fanOutNotification({
      type: input.type,
      templateKey: input.templateKey,
      values: input.values,
      title: input.title,
      body: input.body,
      data: input.data,
      deepLink: input.deepLink ?? null,
      imageUrl: input.imageUrl ?? null,
      audience: {
        products: input.audience.products,
        userIds: input.audience.userIds,
        onlyFreeUsers: input.audience.onlyFreeUsers,
        about: input.audience.about,
      },
      scheduledAt: input.scheduledAt?.toISOString() ?? null,
      dedupeKey: input.dedupeKey,
    });
  }

  /**
   * Creates a single in-app notification and queues its push delivery.
   *
   * When `values` is given the copy is rendered from the shared template in the
   * recipient's own language rather than whatever language the caller happens
   * to be written in.
   */
  async notifyUser(input: {
    userId: string;
    type: NotificationType;
    templateKey?: TemplateKey;
    values?: Record<string, string | number>;
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
    deepLink?: string | null;
  }): Promise<string> {
    let { title, body } = input;
    if (input.values) {
      const rendered = renderTemplate(input.templateKey ?? input.type, input.values);
      title = rendered.title;
      body = rendered.body;
    }

    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: title ?? '',
        body: body ?? '',
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
