import type { FastifyInstance } from 'fastify';
import { prisma } from '@storm-tips/database';
import {
  AppError,
  historyQuerySchema,
  idParamSchema,
  paginationSchema,
  tipFeedQuerySchema,
  type ProductCode,
} from '@storm-tips/types';
import { parseParams, parseQuery } from '../lib/validate.js';
import { noStore, publicCache } from '../lib/http.js';
import { tips } from '../services/tip.service.js';
import { statistics } from '../services/statistics.service.js';
import { serializeFixOddsPlan } from '../serializers/commerce.js';

const PRODUCT_BY_PATH: Record<string, ProductCode> = {
  free: 'FREE',
  vip: 'VIP',
  extra: 'EXTRA',
  combo: 'COMBO',
  'fix-odds': 'FIX_ODDS',
};

export async function tipRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Product feeds.
   *
   * `optionalAuth` rather than `authenticate`: an anonymous visitor still gets
   * the feed, but premium tips come back locked so the paywall has something
   * to show.
   */
  for (const [path, product] of Object.entries(PRODUCT_BY_PATH)) {
    app.get(`/${path}`, { preHandler: [app.optionalAuth] }, async (request, reply) => {
      const query = parseQuery(request, tipFeedQuerySchema);
      noStore(reply);
      return tips.feed(
        {
          ...query,
          product,
          timezone: request.auth?.timezone,
        },
        request.auth?.userId ?? null,
      );
    });

    app.get(`/${path}/list`, { preHandler: [app.optionalAuth] }, async (request, reply) => {
      const query = parseQuery(request, tipFeedQuerySchema);
      noStore(reply);
      return tips.list(
        { ...query, product, timezone: request.auth?.timezone },
        request.auth?.userId ?? null,
      );
    });
  }

  /** Combos are a distinct entity, not a tip list. */
  app.get('/combo/groups', { preHandler: [app.optionalAuth] }, async (request, reply) => {
    const query = parseQuery(
      request,
      paginationSchema.extend(tipFeedQuerySchema.pick({ date: true, includeSettled: true }).shape),
    );
    noStore(reply);
    return tips.combos(
      { ...query, timezone: request.auth?.timezone },
      request.auth?.userId ?? null,
    );
  });

  app.get('/combo/groups/:id', { preHandler: [app.optionalAuth] }, async (request, reply) => {
    const { id } = parseParams(request, idParamSchema);
    noStore(reply);
    return tips.comboById(id, request.auth?.userId ?? null);
  });

  /** Fix Odds packages on sale, with their verified performance. */
  app.get('/fix-odds/plans', async (_request, reply) => {
    const plans = await prisma.fixOddsPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    publicCache(reply, 300);
    return { items: plans.map((plan) => serializeFixOddsPlan(plan)) };
  });

  app.get('/live', { preHandler: [app.optionalAuth] }, async (request, reply) => {
    noStore(reply);
    return { items: await tips.live(request.auth?.userId ?? null) };
  });

  /** Verified results history — public by design. */
  app.get('/history', { preHandler: [app.optionalAuth] }, async (request, reply) => {
    const query = parseQuery(request, historyQuerySchema);
    publicCache(reply, 60);
    return tips.history({ ...query }, request.auth?.userId ?? null);
  });

  app.get('/:id', { preHandler: [app.optionalAuth] }, async (request, reply) => {
    const { id } = parseParams(request, idParamSchema);
    noStore(reply);
    return tips.byId(id, request.auth?.userId ?? null);
  });

  /** Headline figures used by each product paywall. */
  app.get('/:product/headline', async (request) => {
    const { product } = request.params as { product: string };
    const code = PRODUCT_BY_PATH[product];
    if (!code) throw AppError.notFound('Product');
    return statistics.headline(code);
  });
}
