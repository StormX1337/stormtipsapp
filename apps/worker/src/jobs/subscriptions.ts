import type { Job } from 'bullmq';
import { prisma } from '@profit-tips/database';
import { entitlements, notifications } from '@profit-tips/api/services';
import { logger } from '@profit-tips/api/lib/logger';
import { sendMail, subscriptionExpiringEmail } from '@profit-tips/api/lib/mailer';
import type { ProductCode } from '@profit-tips/types';

/**
 * Expires subscriptions whose paid period has elapsed and revokes the
 * entitlements derived from them.
 *
 * A webhook normally does this first; this sweep is the safety net for missed
 * or delayed provider notifications.
 */
export async function expireSubscriptionsJob(job: Job): Promise<unknown> {
  const now = new Date();

  const lapsed = await prisma.subscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE', 'GRACE_PERIOD', 'CANCELED'] },
      currentPeriodEnd: { lt: now },
      OR: [{ gracePeriodEndsAt: null }, { gracePeriodEndsAt: { lt: now } }],
    },
    select: { id: true, userId: true },
    take: 500,
  });

  for (const subscription of lapsed) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'EXPIRED', endedAt: now },
    });
    await entitlements.syncSubscription(subscription.id);
  }

  // Entitlements granted directly (admin, referral reward) also expire.
  const { count: revoked } = await prisma.entitlement.updateMany({
    where: { revokedAt: null, expiresAt: { lt: now } },
    data: { revokedAt: now },
  });

  if (lapsed.length > 0 || revoked > 0) {
    logger.info({ jobId: job.id, expired: lapsed.length, revoked }, 'subscription sweep finished');
  }
  return { expired: lapsed.length, revoked };
}

/** Warns subscribers a few days before their access ends. */
export async function expiringRemindersJob(job: Job): Promise<unknown> {
  const results: Record<number, number> = {};

  for (const days of [7, 3, 1]) {
    const from = new Date(Date.now() + (days - 0.5) * 86_400_000);
    const to = new Date(Date.now() + (days + 0.5) * 86_400_000);

    const expiring = await prisma.subscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'TRIALING'] },
        cancelAtPeriodEnd: true,
        currentPeriodEnd: { gte: from, lte: to },
      },
      include: { user: { select: { id: true, email: true, language: true } } },
      take: 500,
    });

    for (const subscription of expiring) {
      const product = (subscription.products[0] ?? 'VIP') as ProductCode;
      await notifications.notifyUser({
        userId: subscription.userId,
        type: 'SUBSCRIPTION_EXPIRING',
        title: 'Dein Abo läuft bald ab',
        body: `Noch ${days} Tage Zugriff auf ${product}.`,
        deepLink: 'profittips://subscription',
        data: { days, product },
      });
      await sendMail({
        to: subscription.user.email,
        ...subscriptionExpiringEmail(product, days),
      });
    }
    results[days] = expiring.length;
  }

  logger.info({ jobId: job.id, results }, 'expiry reminders finished');
  return results;
}
