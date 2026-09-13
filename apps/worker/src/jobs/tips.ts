import type { Job } from 'bullmq';
import { prisma } from '@profit-tips/database';
import { WS_TOPICS, type ProductCode } from '@profit-tips/types';
import { notifications } from '@profit-tips/api/services';
import { logger } from '@profit-tips/api/lib/logger';
import { serializeTip, tipInclude, serializeCombo, comboInclude } from '@profit-tips/api/serializers/tip';
import { publish } from '../lib/broadcast.js';

const TOPIC_BY_PRODUCT: Record<ProductCode, string> = {
  FREE: WS_TOPICS.tipsFree,
  VIP: WS_TOPICS.tipsVip,
  EXTRA: WS_TOPICS.tipsExtra,
  COMBO: WS_TOPICS.tipsCombo,
  FIX_ODDS: WS_TOPICS.tipsFixOdds,
};

const NOTIFICATION_BY_PRODUCT: Record<ProductCode, string> = {
  FREE: 'NEW_TIP',
  VIP: 'NEW_VIP_TIP',
  EXTRA: 'NEW_EXTRA',
  COMBO: 'NEW_COMBO',
  FIX_ODDS: 'NEW_FIX_ODDS',
};

/** Publishes a single scheduled tip at its `publishAt` time. */
export async function publishTipJob(job: Job<{ tipId: string }>): Promise<unknown> {
  const tip = await prisma.tip.findUnique({ where: { id: job.data.tipId }, include: tipInclude });
  if (!tip) return { skipped: 'not found' };
  if (tip.status === 'PUBLISHED') return { skipped: 'already published' };
  if (tip.status === 'CANCELLED') return { skipped: 'cancelled' };

  const updated = await prisma.tip.update({
    where: { id: tip.id },
    data: { status: 'PUBLISHED' },
    include: tipInclude,
  });

  await announce(updated);
  logger.info({ tipId: tip.id, product: tip.product }, 'scheduled tip published');
  return { published: tip.id };
}

/** Sweep for anything the delayed job missed (restarts, clock drift). */
export async function publishDueTipsJob(job: Job): Promise<unknown> {
  const due = await prisma.tip.findMany({
    where: { status: 'SCHEDULED', publishAt: { lte: new Date() } },
    include: tipInclude,
    take: 200,
  });

  for (const tip of due) {
    const updated = await prisma.tip.update({
      where: { id: tip.id },
      data: { status: 'PUBLISHED' },
      include: tipInclude,
    });
    await announce(updated);
  }

  const combos = await prisma.combo.findMany({
    where: { status: 'SCHEDULED', publishAt: { lte: new Date() } },
    include: comboInclude,
    take: 100,
  });
  for (const combo of combos) {
    const updated = await prisma.combo.update({
      where: { id: combo.id },
      data: { status: 'PUBLISHED' },
      include: comboInclude,
    });
    const payload = serializeCombo(updated, true);
    await publish({
      topic: WS_TOPICS.tipsCombo,
      message: { type: 'combo.published', topic: WS_TOPICS.tipsCombo, payload },
    });
    await notifications.broadcast({
      type: 'NEW_COMBO',
      title: 'Neue Combo verfügbar',
      body: updated.subtitle ?? updated.title,
      deepLink: `profittips://combo/${updated.id}`,
      audience: { products: ['COMBO'] },
      dedupeKey: `combo:${updated.id}`,
    });
  }

  if (due.length > 0 || combos.length > 0) {
    logger.info({ jobId: job.id, tips: due.length, combos: combos.length }, 'scheduled content published');
  }
  return { tips: due.length, combos: combos.length };
}

export async function publishComboJob(job: Job<{ comboId: string }>): Promise<unknown> {
  const combo = await prisma.combo.findUnique({
    where: { id: job.data.comboId },
    include: comboInclude,
  });
  if (!combo || combo.status === 'PUBLISHED') return { skipped: true };
  const updated = await prisma.combo.update({
    where: { id: combo.id },
    data: { status: 'PUBLISHED' },
    include: comboInclude,
  });
  await publish({
    topic: WS_TOPICS.tipsCombo,
    message: {
      type: 'combo.published',
      topic: WS_TOPICS.tipsCombo,
      payload: serializeCombo(updated, true),
    },
  });
  return { published: combo.id };
}

/** Reminds users shortly before kick-off for tips they can access. */
export async function kickoffRemindersJob(job: Job): Promise<unknown> {
  const from = new Date(Date.now() + 25 * 60_000);
  const to = new Date(Date.now() + 35 * 60_000);

  const tips = await prisma.tip.findMany({
    where: {
      status: 'PUBLISHED',
      outcome: 'PENDING',
      event: { startsAt: { gte: from, lte: to }, status: 'SCHEDULED' },
    },
    include: tipInclude,
    take: 100,
  });

  for (const tip of tips) {
    await notifications.broadcast({
      type: 'KICKOFF_REMINDER',
      title: `Anstoß in 30 Minuten`,
      body: `${tip.event.homeTeam.name} – ${tip.event.awayTeam.name}: ${tip.selectionLabel}`,
      deepLink: `profittips://tips/${tip.id}`,
      audience: tip.product === 'FREE' ? {} : { products: [tip.product as ProductCode] },
      dedupeKey: `kickoff:${tip.id}`,
    });
  }

  if (tips.length > 0) logger.info({ jobId: job.id, count: tips.length }, 'kick-off reminders queued');
  return { reminders: tips.length };
}

/** Refreshes the "current odds" shown next to each open tip. */
export async function refreshTipOddsJob(job: Job): Promise<unknown> {
  const openTips = await prisma.tip.findMany({
    where: {
      outcome: { in: ['PENDING', 'LIVE'] },
      status: 'PUBLISHED',
      event: { startsAt: { gt: new Date() } },
    },
    select: {
      id: true,
      odds: true,
      product: true,
      eventId: true,
      marketId: true,
      selectionKey: true,
      line: true,
      bookmakerId: true,
    },
    take: 400,
  });

  let updated = 0;
  for (const tip of openTips) {
    const odd = await prisma.odd.findFirst({
      where: {
        eventId: tip.eventId,
        marketId: tip.marketId,
        selection: tip.selectionKey,
        ...(tip.line !== null ? { line: tip.line } : {}),
        ...(tip.bookmakerId ? { bookmakerId: tip.bookmakerId } : {}),
      },
      orderBy: { lastUpdate: 'desc' },
    });
    if (!odd) continue;

    const current = Number(odd.price);
    const original = Number(tip.odds);
    const changed = Math.abs(current - original) / original > 0.05;

    await prisma.tip.update({
      where: { id: tip.id },
      data: { currentOdds: current, oddsChanged: changed },
    });
    updated += 1;

    if (changed) {
      const topic = TOPIC_BY_PRODUCT[tip.product as ProductCode];
      await publish({
        topic,
        message: {
          type: 'tip.odds',
          topic,
          payload: { tipId: tip.id, currentOdds: current, oddsChanged: true },
        },
      });
    }
  }

  logger.debug({ jobId: job.id, updated }, 'tip odds refreshed');
  return { updated };
}

async function announce(
  tip: Awaited<ReturnType<typeof prisma.tip.findFirstOrThrow>> & { product: string },
): Promise<void> {
  const full = await prisma.tip.findUnique({ where: { id: tip.id }, include: tipInclude });
  if (!full) return;
  const product = full.product as ProductCode;
  const topic = TOPIC_BY_PRODUCT[product];

  await publish({
    topic,
    message: { type: 'tip.published', topic, payload: serializeTip(full, true) },
  });

  await notifications.broadcast({
    type: NOTIFICATION_BY_PRODUCT[product] as never,
    title: full.league.name,
    body: `${full.event.homeTeam.name} – ${full.event.awayTeam.name}: ${full.selectionLabel}`,
    deepLink: `profittips://tips/${full.id}`,
    audience: product === 'FREE' ? {} : { products: [product] },
    dedupeKey: `tip:${full.id}`,
  });
}
