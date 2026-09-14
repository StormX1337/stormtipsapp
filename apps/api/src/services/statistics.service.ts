import { prisma } from '@storm-tips/database';
import { CACHE_TTL, REDIS_KEYS } from '@storm-tips/config';
import { aggregate, windowRange, type StatTip } from '@storm-tips/statistics';
import type { ProductCode, StatisticsDTO, StatsWindow } from '@storm-tips/types';
import { cacheInvalidatePattern, cached } from '../lib/cache.js';
import { env } from '../lib/env.js';

export interface StatisticsQuery {
  product: ProductCode | 'ALL';
  window: StatsWindow;
  stake?: number;
}

/**
 * Computes the published performance figures.
 *
 * Everything the Combo paywall shows ("successful analyses", "return on stake",
 * "average odds") comes from here — settled tips only, never a constant.
 */
export class StatisticsService {
  async compute(query: StatisticsQuery): Promise<StatisticsDTO> {
    const stake = query.stake ?? env.STATISTICS_STAKE;
    const key = `${REDIS_KEYS.statistics(query.product, query.window)}:${stake}`;

    return cached(key, CACHE_TTL.statistics, async () => {
      const earliest = await prisma.tip.findFirst({
        where: { settledAt: { not: null } },
        orderBy: { settledAt: 'asc' },
        select: { settledAt: true },
      });
      const range = windowRange(query.window, new Date(), earliest?.settledAt ?? null);

      const rows = await prisma.tip.findMany({
        where: {
          status: 'PUBLISHED',
          ...(query.product === 'ALL' ? {} : { product: query.product }),
          settledAt: { gte: range.start, lte: range.end },
          outcome: { in: ['WON', 'LOST', 'VOID', 'HALF_WON', 'HALF_LOST'] },
        },
        select: {
          id: true,
          product: true,
          outcome: true,
          odds: true,
          stake: true,
          settledAt: true,
          publishAt: true,
          leagueId: true,
          marketType: true,
          league: { select: { name: true } },
          market: { select: { name: true } },
        },
        orderBy: { settledAt: 'asc' },
      });

      const pendingCount = await prisma.tip.count({
        where: {
          status: 'PUBLISHED',
          ...(query.product === 'ALL' ? {} : { product: query.product }),
          outcome: { in: ['PENDING', 'LIVE'] },
        },
      });

      const statTips: StatTip[] = rows.map((row) => ({
        id: row.id,
        product: row.product as ProductCode,
        outcome: row.outcome,
        odds: Number(row.odds),
        stake: Number(row.stake),
        settledAt: row.settledAt,
        publishedAt: row.publishAt,
        leagueId: row.leagueId,
        leagueName: row.league?.name ?? null,
        marketType: row.marketType,
        marketName: row.market?.name ?? null,
      }));

      const result = aggregate(statTips, { stake, timezone: env.DEFAULT_TIMEZONE });

      return {
        product: query.product,
        window: query.window,
        periodStart: range.start.toISOString(),
        periodEnd: range.end.toISOString(),
        days: range.days,

        totalTips: result.totalTips,
        settledTips: result.settledTips,
        pendingTips: pendingCount,
        won: result.won,
        lost: result.lost,
        void: result.void,
        halfWon: result.halfWon,
        halfLost: result.halfLost,

        winRate: result.winRate,
        roi: result.roi,
        yield: result.yield,
        returnOnStake: result.returnOnStake,
        avgOdds: result.avgOdds,
        avgStake: result.avgStake,
        totalStake: result.totalStake,
        profit: result.profit,

        bestStreak: result.bestStreak,
        worstStreak: result.worstStreak,
        currentStreak: result.currentStreak,

        byDay: result.byDay,
        byWeek: result.byWeek,
        byMonth: result.byMonth,
        byLeague: result.byLeague.slice(0, 25),
        byMarket: result.byMarket.slice(0, 25),
        byProduct: result.byProduct,
      } satisfies StatisticsDTO;
    });
  }

  /**
   * Headline figures for a product paywall — the three circles in the
   * reference design, computed over the whole verified history.
   *
   * For COMBO the "average odds" figure is the average *accumulator* price, not
   * the average leg price: that is the number a buyer is actually shopping for.
   */
  async headline(product: ProductCode): Promise<{
    days: number;
    successfulAnalyses: number;
    returnOnStake: number;
    averageOdds: number;
    winRate: number;
    totalTips: number;
    profit: number;
    stake: number;
  }> {
    const stats = await this.compute({ product, window: 'ALL' });
    let averageOdds = stats.avgOdds;

    if (product === 'COMBO') {
      const combos = await prisma.combo.aggregate({
        where: { settledAt: { not: null } },
        _avg: { totalOdds: true },
      });
      const average = combos._avg.totalOdds;
      if (average) averageOdds = Math.round(Number(average) * 100) / 100;
    }

    return {
      days: stats.days,
      successfulAnalyses: stats.won + stats.halfWon,
      returnOnStake: stats.returnOnStake,
      averageOdds,
      winRate: stats.winRate,
      totalTips: stats.settledTips,
      profit: stats.profit,
      stake: env.STATISTICS_STAKE,
    };
  }

  /** Persists a daily snapshot so historical charts stay fast as data grows. */
  async snapshot(product: ProductCode, window: StatsWindow): Promise<void> {
    const stats = await this.compute({ product, window });
    const periodEnd = new Date(stats.periodEnd);
    await prisma.statisticsSnapshot.upsert({
      where: { product_window_periodEnd: { product, window, periodEnd } },
      update: {
        totalTips: stats.settledTips,
        wonTips: stats.won,
        lostTips: stats.lost,
        voidTips: stats.void,
        halfWonTips: stats.halfWon,
        halfLostTips: stats.halfLost,
        pendingTips: stats.pendingTips,
        winRate: stats.winRate,
        roi: stats.roi,
        yieldPct: stats.yield,
        avgOdds: stats.avgOdds,
        avgStake: stats.avgStake,
        totalStake: stats.totalStake,
        profit: stats.profit,
        bestStreak: stats.bestStreak,
        worstStreak: stats.worstStreak,
        breakdown: { byLeague: stats.byLeague, byMarket: stats.byMarket } as never,
        computedAt: new Date(),
      },
      create: {
        product,
        window,
        periodStart: new Date(stats.periodStart),
        periodEnd,
        totalTips: stats.settledTips,
        wonTips: stats.won,
        lostTips: stats.lost,
        voidTips: stats.void,
        halfWonTips: stats.halfWon,
        halfLostTips: stats.halfLost,
        pendingTips: stats.pendingTips,
        winRate: stats.winRate,
        roi: stats.roi,
        yieldPct: stats.yield,
        avgOdds: stats.avgOdds,
        avgStake: stats.avgStake,
        totalStake: stats.totalStake,
        profit: stats.profit,
        bestStreak: stats.bestStreak,
        worstStreak: stats.worstStreak,
        breakdown: { byLeague: stats.byLeague, byMarket: stats.byMarket } as never,
      },
    });
  }

  async invalidate(): Promise<void> {
    await cacheInvalidatePattern('stats:*');
  }
}

export const statistics = new StatisticsService();
