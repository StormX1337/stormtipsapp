import type { Job } from 'bullmq';
import { prisma } from '@storm-tips/database';
import { statistics } from '@storm-tips/api/services';
import { logger } from '@storm-tips/api/lib/logger';
import type { ProductCode, StatsWindow } from '@storm-tips/types';

const PRODUCTS: (ProductCode | 'ALL')[] = ['ALL', 'FREE', 'VIP', 'EXTRA', 'COMBO', 'FIX_ODDS'];
const WINDOWS: StatsWindow[] = ['D7', 'D30', 'D90', 'M6', 'M12', 'ALL'];

/** Recomputes and persists every (product, window) statistics snapshot. */
export async function recomputeStatisticsJob(job: Job): Promise<unknown> {
  await statistics.invalidate();
  let computed = 0;

  for (const product of PRODUCTS) {
    for (const window of WINDOWS) {
      await statistics.compute({ product, window });
      if (product !== 'ALL') {
        await statistics.snapshot(product, window);
      }
      computed += 1;
    }
  }

  logger.info({ jobId: job.id, computed }, 'statistics recomputed');
  return { computed };
}

/** Housekeeping: prune data that has no further operational value. */
export async function cleanupJob(job: Job): Promise<unknown> {
  const now = new Date();

  const [sessions, tokens, analyticsEvents, webhooks, notificationsPruned] = await Promise.all([
    prisma.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { revokedAt: { lt: new Date(now.getTime() - 30 * 86_400_000) } },
        ],
      },
    }),
    prisma.verificationToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.analyticsEvent.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - 180 * 86_400_000) } },
    }),
    prisma.webhookEvent.deleteMany({
      where: {
        status: 'PROCESSED',
        processedAt: { lt: new Date(now.getTime() - 90 * 86_400_000) },
      },
    }),
    prisma.notification.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - 90 * 86_400_000) } },
    }),
  ]);

  const summary = {
    sessions: sessions.count,
    tokens: tokens.count,
    analyticsEvents: analyticsEvents.count,
    webhooks: webhooks.count,
    notifications: notificationsPruned.count,
  };
  logger.info({ jobId: job.id, ...summary }, 'cleanup finished');
  return summary;
}

/** Closes polls whose end time has passed. */
export async function closePollsJob(job: Job): Promise<unknown> {
  const { count } = await prisma.poll.updateMany({
    where: { status: 'ACTIVE', endsAt: { lt: new Date() } },
    data: { status: 'CLOSED' },
  });
  if (count > 0) logger.info({ jobId: job.id, count }, 'polls closed');
  return { closed: count };
}
