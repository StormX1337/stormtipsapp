import type { Job } from 'bullmq';
import { prisma } from '@storm-tips/database';
import { PushService, type PushTarget } from '@storm-tips/notifications';
import { notifications } from '@storm-tips/api/services';
import { env } from '@storm-tips/api/lib/env';
import { logger } from '@storm-tips/api/lib/logger';
import { redis } from '@storm-tips/api/lib/redis';
import type { NotificationType } from '@storm-tips/types';

const pushService = new PushService({
  expoAccessToken: env.EXPO_ACCESS_TOKEN ?? null,
  fcm: {
    projectId: env.FCM_PROJECT_ID ?? null,
    serviceAccountJsonBase64: env.FCM_SERVICE_ACCOUNT_JSON_BASE64 ?? null,
  },
  apns: {
    keyId: env.APNS_KEY_ID ?? null,
    teamId: env.APNS_TEAM_ID ?? null,
    privateKey: env.APNS_PRIVATE_KEY ?? null,
    bundleId: env.APNS_BUNDLE_ID,
    production: env.APNS_PRODUCTION,
  },
});

const RECEIPT_KEY = 'push:receipts';

export interface FanOutData {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  deepLink?: string | null;
  imageUrl?: string | null;
  audience: {
    products?: string[];
    userIds?: string[];
    onlyFreeUsers?: boolean;
    locale?: string;
  };
}

/**
 * Broadcast fan-out.
 *
 * Resolves the audience (honouring each user's notification preferences),
 * writes one Notification row per recipient so the in-app inbox is complete,
 * then delivers to that user's active device tokens.
 */
export async function fanOutNotificationJob(job: Job<FanOutData>): Promise<unknown> {
  const { type, title, body, data, deepLink, imageUrl, audience } = job.data;
  const recipients = await notifications.resolveAudience(type, audience as never);
  if (recipients.length === 0) return { recipients: 0, sent: 0 };

  const recipientIds = recipients.map((recipient) => recipient.id);

  await prisma.notification.createMany({
    data: recipientIds.map((userId) => ({
      userId,
      type,
      title,
      body,
      imageUrl: imageUrl ?? null,
      deepLink: deepLink ?? null,
      data: (data ?? {}) as never,
      status: 'SENT' as const,
      sentAt: new Date(),
    })),
  });

  const devices = await prisma.deviceToken.findMany({
    where: { userId: { in: recipientIds }, isActive: true },
    select: { token: true, provider: true, platform: true, locale: true, userId: true },
  });

  if (devices.length === 0) return { recipients: recipients.length, sent: 0 };

  const localeByUser = new Map(recipients.map((recipient) => [recipient.id, recipient.language]));
  const targets: PushTarget[] = devices.map((device) => ({
    token: device.token,
    provider: device.provider,
    platform: device.platform,
    locale: device.locale ?? localeByUser.get(device.userId) ?? 'de',
  }));

  const result = await pushService.send(targets, {
    title,
    body,
    data: { type, ...data },
    deepLink: deepLink ?? null,
    imageUrl: imageUrl ?? null,
    priority: 'high',
  });

  await handleDeliveries(result.deliveries);
  logger.info(
    {
      jobId: job.id,
      type,
      recipients: recipients.length,
      sent: result.sent,
      failed: result.failed,
    },
    'notification fan-out finished',
  );
  return { recipients: recipients.length, sent: result.sent, failed: result.failed };
}

/** Delivers one already-persisted notification. */
export async function sendNotificationJob(job: Job<{ notificationId: string }>): Promise<unknown> {
  const notification = await prisma.notification.findUnique({
    where: { id: job.data.notificationId },
  });
  if (!notification?.userId || notification.status === 'SENT') return { skipped: true };

  const devices = await prisma.deviceToken.findMany({
    where: { userId: notification.userId, isActive: true },
  });
  if (devices.length === 0) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: 'SENT', sentAt: new Date() },
    });
    return { sent: 0 };
  }

  const result = await pushService.send(
    devices.map((device) => ({
      token: device.token,
      provider: device.provider,
      platform: device.platform,
      locale: device.locale,
    })),
    {
      title: notification.title,
      body: notification.body,
      data: (notification.data ?? {}) as Record<string, unknown>,
      deepLink: notification.deepLink,
      imageUrl: notification.imageUrl,
    },
  );

  await handleDeliveries(result.deliveries);
  await prisma.notification.update({
    where: { id: notification.id },
    data: {
      status: result.sent > 0 ? 'SENT' : 'FAILED',
      sentAt: new Date(),
      error: result.sent > 0 ? null : (result.deliveries[0]?.error ?? 'delivery failed'),
    },
  });
  return { sent: result.sent, failed: result.failed };
}

/** Deactivates dead tokens and stores receipt ids for the follow-up poll. */
async function handleDeliveries(
  deliveries: { token: string; ok: boolean; receiptId?: string | null; unregistered?: boolean }[],
): Promise<void> {
  const dead = deliveries.filter((delivery) => delivery.unregistered).map((d) => d.token);
  if (dead.length > 0) {
    await prisma.deviceToken.updateMany({
      where: { token: { in: dead } },
      data: { isActive: false },
    });
    logger.info({ count: dead.length }, 'deactivated unregistered push tokens');
  }

  const receipts = deliveries
    .filter((delivery) => delivery.ok && delivery.receiptId)
    .map((delivery) => `${delivery.receiptId}|${delivery.token}`);
  if (receipts.length > 0) {
    await redis.sadd(RECEIPT_KEY, ...receipts);
    await redis.expire(RECEIPT_KEY, 3 * 86_400);
  }
}

/**
 * Second phase of Expo delivery: a receipt is the only reliable signal that a
 * token is dead, so it is polled separately a few minutes after sending.
 */
export async function checkPushReceiptsJob(job: Job): Promise<unknown> {
  const entries = await redis.spop(RECEIPT_KEY, 500);
  if (!entries || entries.length === 0) return { checked: 0 };

  const tokenByReceipt = new Map<string, string>();
  for (const entry of entries) {
    const [receiptId, token] = entry.split('|');
    if (receiptId && token) tokenByReceipt.set(receiptId, token);
  }

  const receipts = await pushService.checkReceipts('EXPO', [...tokenByReceipt.keys()]);
  const dead = receipts
    .filter((receipt) => receipt.unregistered)
    .map((receipt) => tokenByReceipt.get(receipt.receiptId ?? ''))
    .filter((token): token is string => Boolean(token));

  if (dead.length > 0) {
    await prisma.deviceToken.updateMany({
      where: { token: { in: dead } },
      data: { isActive: false },
    });
  }

  logger.debug(
    { jobId: job.id, checked: receipts.length, dead: dead.length },
    'push receipts checked',
  );
  return { checked: receipts.length, dead: dead.length };
}

/** Sends any notification whose scheduled time has arrived. */
export async function sendScheduledJob(job: Job): Promise<unknown> {
  const due = await prisma.notification.findMany({
    where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
    select: { id: true },
    take: 200,
  });
  for (const notification of due) {
    await sendNotificationJob({ data: { notificationId: notification.id }, id: job.id } as Job<{
      notificationId: string;
    }>);
  }
  return { sent: due.length };
}
