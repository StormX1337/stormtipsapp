import type { Prisma } from '@storm-tips/database';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type EntitlementDTO,
  type NotificationDTO,
  type NotificationPreferences,
  type UserDTO,
} from '@storm-tips/types';
import { iso } from './common.js';

export function mergePreferences(raw: unknown): NotificationPreferences {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  const partial = raw as Partial<NotificationPreferences>;
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...partial };
}

export function serializeUser(
  user: Prisma.UserGetPayload<object>,
  entitlements: EntitlementDTO[] = [],
): UserDTO {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
    countryCode: user.countryCode,
    language: user.language,
    timezone: user.timezone,
    currency: user.currency,
    marketingOptIn: user.marketingOptIn,
    notificationPrefs: mergePreferences(user.notificationPrefs),
    favoriteLeagueIds: user.favoriteLeagueIds,
    favoriteTeamIds: user.favoriteTeamIds,
    referralCode: user.referralCode,
    createdAt: user.createdAt.toISOString(),
    entitlements,
  };
}

export function serializeNotification(
  notification: Prisma.NotificationGetPayload<object>,
): NotificationDTO {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    imageUrl: notification.imageUrl,
    deepLink: notification.deepLink,
    data: (notification.data ?? {}) as Record<string, unknown>,
    readAt: iso(notification.readAt),
    sentAt: iso(notification.sentAt),
    createdAt: notification.createdAt.toISOString(),
  };
}
