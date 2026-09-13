import type { FastifyInstance } from 'fastify';
import { prisma } from '@profit-tips/database';
import { CACHE_TTL } from '@profit-tips/config';
import { statisticsQuerySchema, type ProductCode } from '@profit-tips/types';
import { parseQuery } from '../lib/validate.js';
import { publicCache } from '../lib/http.js';
import { statistics } from '../services/statistics.service.js';

export async function statisticsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request, reply) => {
    const query = parseQuery(request, statisticsQuerySchema);
    publicCache(reply, CACHE_TTL.statistics);
    return statistics.compute(query);
  });

  /** One call for the statistics screen: every product side by side. */
  app.get('/overview', async (request, reply) => {
    const query = parseQuery(request, statisticsQuerySchema.pick({ window: true }));
    const products: (ProductCode | 'ALL')[] = ['ALL', 'FREE', 'VIP', 'EXTRA', 'COMBO', 'FIX_ODDS'];
    const items = await Promise.all(
      products.map(async (product) => statistics.compute({ product, window: query.window })),
    );
    publicCache(reply, CACHE_TTL.statistics);
    return {
      window: query.window,
      items: items.map((item) => ({
        product: item.product,
        days: item.days,
        settledTips: item.settledTips,
        won: item.won,
        lost: item.lost,
        winRate: item.winRate,
        roi: item.roi,
        returnOnStake: item.returnOnStake,
        avgOdds: item.avgOdds,
        profit: item.profit,
        bestStreak: item.bestStreak,
      })),
    };
  });

  /** Persisted daily snapshots — used for long-range charts. */
  app.get('/snapshots', async (request, reply) => {
    const query = parseQuery(request, statisticsQuerySchema.pick({ product: true, window: true }));
    const snapshots = await prisma.statisticsSnapshot.findMany({
      where: {
        ...(query.product === 'ALL' ? {} : { product: query.product }),
        window: query.window,
      },
      orderBy: { periodEnd: 'asc' },
      take: 400,
    });
    publicCache(reply, CACHE_TTL.statistics);
    return {
      items: snapshots.map((snapshot) => ({
        product: snapshot.product,
        window: snapshot.window,
        periodEnd: snapshot.periodEnd.toISOString(),
        totalTips: snapshot.totalTips,
        wonTips: snapshot.wonTips,
        winRate: Number(snapshot.winRate),
        roi: Number(snapshot.roi),
        avgOdds: Number(snapshot.avgOdds),
        profit: Number(snapshot.profit),
      })),
    };
  });
}
