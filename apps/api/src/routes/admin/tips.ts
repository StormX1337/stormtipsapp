import type { FastifyInstance } from 'fastify';
import { prisma, type Prisma } from '@profit-tips/database';
import {
  AppError,
  adminTipsQuerySchema,
  createComboSchema,
  createTipSchema,
  idParamSchema,
  importTipsSchema,
  isValidSelection,
  marketRequiresLine,
  settleTipSchema,
  updateComboSchema,
  updateTipSchema,
  WS_TOPICS,
  type ProductCode,
} from '@profit-tips/types';
import { comboOdds } from '@profit-tips/statistics';
import { parseBody, parseParams, parseQuery } from '../../lib/validate.js';
import { assertFound, paginate, skipTake } from '../../lib/http.js';
import { audit } from '../../lib/audit.js';
import { jobs } from '../../lib/queues.js';
import { comboInclude, serializeCombo, serializeTip, tipInclude } from '../../serializers/tip.js';
import { settlement } from '../../services/settlement.service.js';
import { statistics } from '../../services/statistics.service.js';
import { notifications } from '../../services/notification.service.js';
import { broadcast } from '../../ws/gateway.js';

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

/** Validates the selection against the market and resolves the market row. */
async function resolveMarket(input: {
  marketId?: string;
  marketType: string;
  selectionKey: string;
  line?: number | null;
}): Promise<string> {
  if (!isValidSelection(input.marketType as never, input.selectionKey)) {
    throw AppError.validation(
      `Selection "${input.selectionKey}" is not valid for market ${input.marketType}`,
    );
  }
  if (marketRequiresLine(input.marketType as never) && (input.line === null || input.line === undefined)) {
    throw AppError.validation(`Market ${input.marketType} requires a line`);
  }

  if (input.marketId) {
    const market = await prisma.market.findUnique({ where: { id: input.marketId } });
    if (market) return market.id;
  }
  const byType = await prisma.market.findFirst({ where: { type: input.marketType as never } });
  if (!byType) throw AppError.validation(`No market configured for type ${input.marketType}`);
  return byType.id;
}

export async function adminTipRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', { preHandler: [app.requireCapability('tips:read')] }, async (request) => {
    const query = parseQuery(request, adminTipsQuerySchema);
    const { skip, take } = skipTake(query);

    const where: Prisma.TipWhereInput = {
      ...(query.product ? { product: query.product } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.outcome ? { outcome: query.outcome } : {}),
      ...(query.leagueId ? { leagueId: query.leagueId } : {}),
      ...(query.eventId ? { eventId: query.eventId } : {}),
      ...(query.search
        ? {
            OR: [
              { selectionLabel: { contains: query.search, mode: 'insensitive' } },
              { title: { contains: query.search, mode: 'insensitive' } },
              { event: { homeTeam: { name: { contains: query.search, mode: 'insensitive' } } } },
              { event: { awayTeam: { name: { contains: query.search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(`${query.from}T00:00:00Z`) } : {}),
              ...(query.to ? { lte: new Date(`${query.to}T23:59:59Z`) } : {}),
            },
          }
        : {}),
    };

    const [tips, total] = await Promise.all([
      prisma.tip.findMany({ where, include: tipInclude, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.tip.count({ where }),
    ]);

    // Admins always see the full tip, never a masked one.
    return paginate(tips.map((tip) => serializeTip(tip, true)), total, query);
  });

  app.get('/:id', { preHandler: [app.requireCapability('tips:read')] }, async (request) => {
    const { id } = parseParams(request, idParamSchema);
    const tip = assertFound(
      await prisma.tip.findUnique({ where: { id }, include: tipInclude }),
      'Tip',
    );
    return serializeTip(tip, true);
  });

  app.post('/', { preHandler: [app.requireCapability('tips:write')] }, async (request, reply) => {
    const input = parseBody(request, createTipSchema);
    const event = assertFound(
      await prisma.event.findUnique({
        where: { id: input.eventId },
        include: { league: true },
      }),
      'Event',
    );
    const marketId = await resolveMarket(input);

    const tip = await prisma.tip.create({
      data: {
        sportId: event.sportId,
        countryId: event.league.countryId,
        leagueId: event.leagueId,
        eventId: event.id,
        marketId,
        bookmakerId: input.bookmakerId ?? null,
        marketType: input.marketType,
        selectionLabel: input.selectionLabel,
        selectionKey: input.selectionKey,
        line: input.line ?? null,
        odds: input.odds,
        originalOdds: input.odds,
        currentOdds: input.odds,
        stake: input.stake,
        confidence: input.confidence,
        confidenceBand: input.confidenceBand ?? bandFor(input.confidence),
        product: input.product,
        status: input.status,
        isLive: input.isLive,
        isStandalone: input.isStandalone,
        title: input.title ?? null,
        analysis: input.analysis ?? null,
        imageUrl: input.imageUrl ?? null,
        tags: input.tags,
        source: input.source ?? null,
        publishAt: input.publishAt ? new Date(input.publishAt) : null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : event.startsAt,
        fixOddsPlanId: input.fixOddsPlanId ?? null,
        createdById: request.auth!.userId,
      },
      include: tipInclude,
    });

    if (tip.status === 'SCHEDULED' && tip.publishAt) {
      await jobs.publishTip(tip.id, tip.publishAt);
    }
    if (tip.status === 'PUBLISHED') {
      await announceTip(tip);
    }

    await audit(request, { action: 'tip.created', entityType: 'Tip', entityId: tip.id, after: input });
    reply.status(201);
    return serializeTip(tip, true);
  });

  app.patch('/:id', { preHandler: [app.requireCapability('tips:write')] }, async (request) => {
    const { id } = parseParams(request, idParamSchema);
    const input = parseBody(request, updateTipSchema);
    const existing = assertFound(await prisma.tip.findUnique({ where: { id } }), 'Tip');
    if (existing.settledAt) {
      throw AppError.conflict('A settled tip can no longer be edited');
    }

    const marketId =
      input.marketType && input.selectionKey
        ? await resolveMarket({
            marketId: input.marketId,
            marketType: input.marketType,
            selectionKey: input.selectionKey,
            line: input.line,
          })
        : undefined;

    const tip = await prisma.tip.update({
      where: { id },
      data: {
        marketId,
        marketType: input.marketType,
        selectionLabel: input.selectionLabel,
        selectionKey: input.selectionKey,
        line: input.line,
        odds: input.odds,
        currentOdds: input.odds,
        stake: input.stake,
        bookmakerId: input.bookmakerId,
        confidence: input.confidence,
        confidenceBand: input.confidence ? bandFor(input.confidence) : undefined,
        product: input.product,
        status: input.status,
        isLive: input.isLive,
        title: input.title,
        analysis: input.analysis,
        imageUrl: input.imageUrl,
        tags: input.tags,
        source: input.source,
        publishAt: input.publishAt ? new Date(input.publishAt) : undefined,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        fixOddsPlanId: input.fixOddsPlanId,
      },
      include: tipInclude,
    });

    await audit(request, {
      action: 'tip.updated',
      entityType: 'Tip',
      entityId: id,
      before: existing,
      after: input,
    });
    return serializeTip(tip, true);
  });

  app.post('/:id/publish', { preHandler: [app.requireCapability('tips:publish')] }, async (request) => {
    const { id } = parseParams(request, idParamSchema);
    const tip = await prisma.tip.update({
      where: { id },
      data: { status: 'PUBLISHED', publishAt: new Date() },
      include: tipInclude,
    });
    await announceTip(tip);
    await audit(request, { action: 'tip.published', entityType: 'Tip', entityId: id });
    return serializeTip(tip, true);
  });

  app.post('/:id/cancel', { preHandler: [app.requireCapability('tips:publish')] }, async (request) => {
    const { id } = parseParams(request, idParamSchema);
    const tip = await prisma.tip.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: tipInclude,
    });
    await audit(request, { action: 'tip.cancelled', entityType: 'Tip', entityId: id });
    return serializeTip(tip, true);
  });

  app.post('/:id/settle', { preHandler: [app.requireCapability('tips:settle')] }, async (request) => {
    const { id } = parseParams(request, idParamSchema);
    const input = parseBody(request, settleTipSchema);
    await settlement.settleManually(id, input.outcome, request.auth!.userId, {
      homeScore: input.homeScore,
      awayScore: input.awayScore,
      note: input.note,
    });
    await statistics.invalidate();
    await audit(request, {
      action: 'tip.settled',
      entityType: 'Tip',
      entityId: id,
      after: input,
    });
    const tip = await prisma.tip.findUniqueOrThrow({ where: { id }, include: tipInclude });
    return serializeTip(tip, true);
  });

  app.post('/:id/resettle', { preHandler: [app.requireCapability('tips:settle')] }, async (request) => {
    const { id } = parseParams(request, idParamSchema);
    await settlement.resettle(id, request.auth!.userId);
    await statistics.invalidate();
    await audit(request, { action: 'tip.resettled', entityType: 'Tip', entityId: id });
    return { success: true };
  });

  app.delete('/:id', { preHandler: [app.requireCapability('tips:delete')] }, async (request) => {
    const { id } = parseParams(request, idParamSchema);
    const existing = assertFound(await prisma.tip.findUnique({ where: { id } }), 'Tip');
    await prisma.tip.delete({ where: { id } });
    await audit(request, { action: 'tip.deleted', entityType: 'Tip', entityId: id, before: existing });
    return { success: true };
  });

  /** Bulk import — every row is validated; one bad row fails the whole batch. */
  app.post('/import', { preHandler: [app.requireCapability('tips:write')] }, async (request, reply) => {
    const { tips: rows } = parseBody(request, importTipsSchema);
    const created: string[] = [];

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const event = await tx.event.findUnique({
          where: { id: row.eventId },
          include: { league: true },
        });
        if (!event) throw AppError.validation(`Unknown event ${row.eventId}`);
        const marketId = await resolveMarket(row);
        const tip = await tx.tip.create({
          data: {
            sportId: event.sportId,
            countryId: event.league.countryId,
            leagueId: event.leagueId,
            eventId: event.id,
            marketId,
            bookmakerId: row.bookmakerId ?? null,
            marketType: row.marketType,
            selectionLabel: row.selectionLabel,
            selectionKey: row.selectionKey,
            line: row.line ?? null,
            odds: row.odds,
            originalOdds: row.odds,
            currentOdds: row.odds,
            stake: row.stake,
            confidence: row.confidence,
            confidenceBand: bandFor(row.confidence),
            product: row.product,
            status: row.status,
            isLive: row.isLive,
            isStandalone: row.isStandalone,
            analysis: row.analysis ?? null,
            tags: row.tags,
            publishAt: row.publishAt ? new Date(row.publishAt) : null,
            expiresAt: row.expiresAt ? new Date(row.expiresAt) : event.startsAt,
            createdById: request.auth!.userId,
          },
        });
        created.push(tip.id);
      }
    });

    await audit(request, {
      action: 'tip.imported',
      entityType: 'Tip',
      after: { count: created.length },
    });
    reply.status(201);
    return { created: created.length, ids: created };
  });

  /** Tips whose market cannot be settled automatically. */
  app.get('/queue/manual', { preHandler: [app.requireCapability('tips:settle')] }, async () => {
    const queue = await settlement.manualQueue();
    return { items: queue.map((tip) => ({ id: tip.id, selectionLabel: tip.selectionLabel, marketType: tip.marketType, eventId: tip.eventId })) };
  });

  // ── combos ────────────────────────────────────────────────────────────────

  app.get('/combos', { preHandler: [app.requireCapability('tips:read')] }, async (request) => {
    const query = parseQuery(request, adminTipsQuerySchema);
    const { skip, take } = skipTake(query);
    const where: Prisma.ComboWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.outcome ? { outcome: query.outcome } : {}),
    };
    const [combos, total] = await Promise.all([
      prisma.combo.findMany({ where, include: comboInclude, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.combo.count({ where }),
    ]);
    return paginate(combos.map((combo) => serializeCombo(combo, true)), total, query);
  });

  app.post('/combos', { preHandler: [app.requireCapability('combos:write')] }, async (request, reply) => {
    const input = parseBody(request, createComboSchema);
    const legs = await prisma.tip.findMany({ where: { id: { in: input.tipIds } } });
    if (legs.length !== input.tipIds.length) {
      throw AppError.validation('One or more selections could not be found');
    }

    const totalOdds = comboOdds(legs.map((leg) => Number(leg.odds)));
    const combo = await prisma.combo.create({
      data: {
        title: input.title,
        subtitle: input.subtitle ?? `${legs.length} Auswahlen · Gesamtquote ${totalOdds.toFixed(2)}`,
        product: input.product,
        status: input.status,
        totalOdds,
        stake: input.stake,
        analysis: input.analysis ?? null,
        publishAt: input.publishAt ? new Date(input.publishAt) : null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        createdById: request.auth!.userId,
        items: {
          create: input.tipIds.map((tipId, index) => ({ tipId, sortOrder: index })),
        },
      },
      include: comboInclude,
    });

    // Combo legs are not shown on their own in the product feeds.
    await prisma.tip.updateMany({
      where: { id: { in: input.tipIds } },
      data: { isStandalone: false, product: input.product },
    });

    if (combo.status === 'SCHEDULED' && combo.publishAt) {
      await jobs.publishCombo(combo.id, combo.publishAt);
    }

    await audit(request, { action: 'combo.created', entityType: 'Combo', entityId: combo.id, after: input });
    reply.status(201);
    return serializeCombo(combo, true);
  });

  app.patch('/combos/:id', { preHandler: [app.requireCapability('combos:write')] }, async (request) => {
    const { id } = parseParams(request, idParamSchema);
    const input = parseBody(request, updateComboSchema);
    const existing = assertFound(await prisma.combo.findUnique({ where: { id } }), 'Combo');
    if (existing.settledAt) throw AppError.conflict('A settled combo can no longer be edited');

    if (input.tipIds) {
      const legs = await prisma.tip.findMany({ where: { id: { in: input.tipIds } } });
      if (legs.length !== input.tipIds.length) {
        throw AppError.validation('One or more selections could not be found');
      }
      await prisma.$transaction([
        prisma.comboItem.deleteMany({ where: { comboId: id } }),
        prisma.comboItem.createMany({
          data: input.tipIds.map((tipId, index) => ({ comboId: id, tipId, sortOrder: index })),
        }),
        prisma.combo.update({
          where: { id },
          data: { totalOdds: comboOdds(legs.map((leg) => Number(leg.odds))) },
        }),
      ]);
    }

    const combo = await prisma.combo.update({
      where: { id },
      data: {
        title: input.title,
        subtitle: input.subtitle,
        product: input.product,
        status: input.status,
        stake: input.stake,
        analysis: input.analysis,
        publishAt: input.publishAt ? new Date(input.publishAt) : undefined,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      },
      include: comboInclude,
    });

    await audit(request, { action: 'combo.updated', entityType: 'Combo', entityId: id, after: input });
    return serializeCombo(combo, true);
  });

  app.post('/combos/:id/publish', { preHandler: [app.requireCapability('tips:publish')] }, async (request) => {
    const { id } = parseParams(request, idParamSchema);
    const combo = await prisma.combo.update({
      where: { id },
      data: { status: 'PUBLISHED', publishAt: new Date() },
      include: comboInclude,
    });
    const dto = serializeCombo(combo, true);
    await broadcast({
      topic: WS_TOPICS.tipsCombo,
      message: { type: 'combo.published', topic: WS_TOPICS.tipsCombo, payload: dto },
    });
    await notifications.broadcast({
      type: 'NEW_COMBO',
      title: 'Neue Combo verfügbar',
      body: combo.subtitle ?? combo.title,
      deepLink: `profittips://combo/${combo.id}`,
      audience: { products: ['COMBO'] },
      dedupeKey: `combo:${combo.id}`,
    });
    await audit(request, { action: 'combo.published', entityType: 'Combo', entityId: id });
    return dto;
  });

  app.delete('/combos/:id', { preHandler: [app.requireCapability('tips:delete')] }, async (request) => {
    const { id } = parseParams(request, idParamSchema);
    await prisma.combo.delete({ where: { id } });
    await audit(request, { action: 'combo.deleted', entityType: 'Combo', entityId: id });
    return { success: true };
  });
}

function bandFor(confidence: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' {
  if (confidence >= 85) return 'VERY_HIGH';
  if (confidence >= 70) return 'HIGH';
  if (confidence >= 55) return 'MEDIUM';
  return 'LOW';
}

/** Pushes a freshly published tip to sockets and to subscribers' devices. */
async function announceTip(tip: Awaited<ReturnType<typeof prisma.tip.findFirstOrThrow>> & { product: string }): Promise<void> {
  const full = await prisma.tip.findUnique({ where: { id: tip.id }, include: tipInclude });
  if (!full) return;
  const product = full.product as ProductCode;
  const topic = TOPIC_BY_PRODUCT[product];

  await broadcast({
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
