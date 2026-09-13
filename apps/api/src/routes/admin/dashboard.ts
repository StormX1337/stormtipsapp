import type { FastifyInstance } from 'fastify';
import { prisma } from '@profit-tips/database';
import type { AdminDashboardDTO, ProductCode } from '@profit-tips/types';
import { env } from '../../lib/env.js';
import { money } from '../../serializers/common.js';
import { statistics } from '../../services/statistics.service.js';
import { analytics } from '../../services/analytics.service.js';

const DAY_MS = 86_400_000;

function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function adminDashboardRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireCapability('statistics:read'));

  app.get('/', async (): Promise<AdminDashboardDTO> => {
    const today = startOfToday();
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const thirtyDaysAgo = new Date(Date.now() - 30 * DAY_MS);
    const currency = env.DEFAULT_CURRENCY;

    const [
      revenueToday,
      revenueMonth,
      revenueTotal,
      activeSubscriptions,
      totalUsers,
      newToday,
      new30d,
      active30d,
      banned,
      trialing,
      cancelledThisMonth,
      tipStats,
      publishedTips,
      pendingTips,
    ] = await Promise.all([
      prisma.payment.aggregate({
        where: { status: 'SUCCEEDED', paidAt: { gte: today } },
        _sum: { amountCents: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'SUCCEEDED', paidAt: { gte: monthStart } },
        _sum: { amountCents: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'SUCCEEDED' },
        _sum: { amountCents: true },
      }),
      prisma.subscription.findMany({
        where: { status: { in: ['ACTIVE', 'TRIALING', 'GRACE_PERIOD', 'PAST_DUE'] } },
        select: { products: true, priceCents: true, plan: { select: { interval: true, intervalCount: true } } },
      }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.count({ where: { lastLoginAt: { gte: thirtyDaysAgo } } }),
      prisma.user.count({ where: { status: 'BANNED' } }),
      prisma.subscription.count({ where: { status: 'TRIALING' } }),
      prisma.subscription.count({ where: { canceledAt: { gte: monthStart } } }),
      statistics.compute({ product: 'ALL', window: 'D30' }),
      prisma.tip.count({ where: { status: 'PUBLISHED' } }),
      prisma.tip.count({ where: { outcome: { in: ['PENDING', 'LIVE'] } } }),
    ]);

    // MRR: normalise every active subscription price to a monthly figure.
    let mrrCents = 0;
    const byProduct: Record<ProductCode, number> = { FREE: 0, VIP: 0, EXTRA: 0, COMBO: 0, FIX_ODDS: 0 };
    for (const subscription of activeSubscriptions) {
      const months =
        subscription.plan?.interval === 'YEAR'
          ? (subscription.plan?.intervalCount ?? 1) * 12
          : (subscription.plan?.intervalCount ?? 1);
      mrrCents += Math.round((subscription.priceCents ?? 0) / Math.max(1, months));
      for (const product of subscription.products) {
        byProduct[product as ProductCode] = (byProduct[product as ProductCode] ?? 0) + 1;
      }
    }

    const [revenueByDay, signupsByDay] = await Promise.all([
      prisma.$queryRaw<{ date: Date; sum: bigint }[]>`
        SELECT date_trunc('day', "paidAt") AS date, SUM("amountCents")::bigint AS sum
        FROM payments
        WHERE status = 'SUCCEEDED' AND "paidAt" >= ${thirtyDaysAgo}
        GROUP BY 1 ORDER BY 1
      `,
      prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT date_trunc('day', "createdAt") AS date, COUNT(*)::bigint AS count
        FROM users
        WHERE "createdAt" >= ${thirtyDaysAgo}
        GROUP BY 1 ORDER BY 1
      `,
    ]);

    const subscriberCount = activeSubscriptions.length;

    return {
      revenue: {
        today: money(revenueToday._sum.amountCents ?? 0, currency),
        month: money(revenueMonth._sum.amountCents ?? 0, currency),
        total: money(revenueTotal._sum.amountCents ?? 0, currency),
        mrr: money(mrrCents, currency),
      },
      users: { total: totalUsers, active30d, newToday, new30d, banned },
      subscribers: {
        total: subscriberCount,
        byProduct,
        trialing,
        cancelledThisMonth,
        conversionRate: totalUsers > 0 ? Math.round((subscriberCount / totalUsers) * 1000) / 10 : 0,
        churnRate:
          subscriberCount > 0
            ? Math.round((cancelledThisMonth / (subscriberCount + cancelledThisMonth)) * 1000) / 10
            : 0,
      },
      tips: {
        published: publishedTips,
        won: tipStats.won,
        lost: tipStats.lost,
        pending: pendingTips,
        roi: tipStats.roi,
        avgOdds: tipStats.avgOdds,
        winRate: tipStats.winRate,
      },
      charts: {
        revenueByDay: revenueByDay.map((row) => ({
          date: row.date.toISOString().slice(0, 10),
          amountCents: Number(row.sum),
        })),
        signupsByDay: signupsByDay.map((row) => ({
          date: row.date.toISOString().slice(0, 10),
          count: Number(row.count),
        })),
        profitByDay: tipStats.byDay,
      },
    };
  });

  app.get('/funnel', async (request) => {
    const days = Number((request.query as { days?: string }).days ?? 30);
    return { items: await analytics.funnel(Number.isFinite(days) ? days : 30) };
  });

  /** Per-product performance table for the admin statistics screen. */
  app.get('/performance', async (request) => {
    const window = ((request.query as { window?: string }).window ?? 'D30') as never;
    const products: ProductCode[] = ['FREE', 'VIP', 'EXTRA', 'COMBO', 'FIX_ODDS'];
    const rows = await Promise.all(
      products.map(async (product) => {
        const stats = await statistics.compute({ product, window });
        return {
          product,
          settledTips: stats.settledTips,
          won: stats.won,
          lost: stats.lost,
          winRate: stats.winRate,
          roi: stats.roi,
          avgOdds: stats.avgOdds,
          profit: stats.profit,
          bestStreak: stats.bestStreak,
        };
      }),
    );
    return { window, items: rows };
  });
}
