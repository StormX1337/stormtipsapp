import type { Job } from 'bullmq';
import { prisma } from '@storm-tips/database';
import { settlement, statistics, sync, notifications } from '@storm-tips/api/services';
import { logger } from '@storm-tips/api/lib/logger';
import { WS_TOPICS, type ProductCode } from '@storm-tips/types';
import { serializeTip, tipInclude } from '@storm-tips/api/serializers/tip';
import { publish } from '../lib/broadcast.js';

const TOPIC_BY_PRODUCT: Record<ProductCode, string> = {
  FREE: WS_TOPICS.tipsFree,
  VIP: WS_TOPICS.tipsVip,
  EXTRA: WS_TOPICS.tipsExtra,
  COMBO: WS_TOPICS.tipsCombo,
  FIX_ODDS: WS_TOPICS.tipsFixOdds,
};

/**
 * Pulls final scores, then settles everything that became settleable.
 *
 * Both halves are idempotent, so a retry after a partial failure is safe.
 */
export async function syncResultsJob(job: Job<{ eventIds?: string[] }>): Promise<unknown> {
  const pulled = await sync.syncResults(job.data ?? {});
  const before = await prisma.tip.findMany({
    where: { outcome: { in: ['PENDING', 'LIVE'] }, event: { status: 'FINISHED' } },
    select: { id: true },
    take: 500,
  });

  const summary = await settlement.settleDueTips();

  // Tell subscribed clients about every tip that just got a result.
  for (const { id } of before) {
    const tip = await prisma.tip.findUnique({ where: { id }, include: tipInclude });
    if (!tip?.result) continue;
    const topic = TOPIC_BY_PRODUCT[tip.product as ProductCode];
    await publish({
      topic,
      message: { type: 'tip.settled', topic, payload: serializeTip(tip, true) },
    });
  }

  if (summary.settled > 0) {
    await notifyResults();
  }

  logger.info({ jobId: job.id, pulled: pulled.results, ...summary }, 'result sync finished');
  return { pulled: pulled.results, ...summary };
}

/** One digest per user per run, rather than a push per settled tip. */
async function notifyResults(): Promise<void> {
  const since = new Date(Date.now() - 15 * 60_000);
  const settled = await prisma.tip.groupBy({
    by: ['product', 'outcome'],
    where: { settledAt: { gte: since } },
    _count: { _all: true },
  });
  if (settled.length === 0) return;

  const byProduct = new Map<string, { won: number; lost: number }>();
  for (const row of settled) {
    const entry = byProduct.get(row.product) ?? { won: 0, lost: 0 };
    if (row.outcome === 'WON' || row.outcome === 'HALF_WON') entry.won += row._count._all;
    if (row.outcome === 'LOST' || row.outcome === 'HALF_LOST') entry.lost += row._count._all;
    byProduct.set(row.product, entry);
  }

  for (const [product, counts] of byProduct) {
    if (counts.won + counts.lost === 0) continue;
    await notifications.broadcast({
      type: 'TIP_RESULT',
      templateKey: 'TIP_RESULT_SUMMARY',
      values: { product, won: counts.won, lost: counts.lost },
      deepLink: 'stormtips://history',
      audience: product === 'FREE' ? {} : { products: [product as ProductCode] },
      dedupeKey: `results:${product}:${Math.floor(Date.now() / 900_000)}`,
    });
  }
}

export async function settleDueJob(job: Job): Promise<unknown> {
  const summary = await settlement.settleDueTips();
  if (summary.settled > 0 || summary.combosSettled > 0) {
    await statistics.invalidate();
  }
  logger.info({ jobId: job.id, ...summary }, 'settlement sweep finished');
  return summary;
}
