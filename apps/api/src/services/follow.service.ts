import { prisma } from '@storm-tips/database';
import { aggregate, windowRange, type StatTip } from '@storm-tips/statistics';
import type { ProductCode, StatisticsDTO, StatsWindow } from '@storm-tips/types';
import { env } from '../lib/env.js';

/**
 * A reader's own record.
 *
 * The published statistics answer "how has STORM TIPS done?"; this answers "how
 * have I done?", which is a different question whenever someone skips a
 * selection or stakes a different amount on it. The outcome of each tip still
 * comes from the published settlement, so the two can never disagree about what
 * happened — only about what was taken and for how much.
 */
export class FollowService {
  /** Adds a tip to the reader's record, or updates the stake if it is already there. */
  async follow(userId: string, tipId: string, stake?: number): Promise<{ stake: number }> {
    // Anyone can follow any published tip; a locked one is never shown to them
    // in the first place, and the stake alone reveals nothing about the pick.
    const tip = await prisma.tip.findFirstOrThrow({
      where: { id: tipId, status: 'PUBLISHED' },
      select: { id: true, stake: true },
    });
    const value = stake ?? Number(tip.stake);
    const row = await prisma.tipFollow.upsert({
      where: { userId_tipId: { userId, tipId } },
      create: { userId, tipId, stake: value },
      update: { stake: value },
      select: { stake: true },
    });
    return { stake: Number(row.stake) };
  }

  async unfollow(userId: string, tipId: string): Promise<void> {
    await prisma.tipFollow.deleteMany({ where: { userId, tipId } });
  }

  /**
   * Every tip id the reader follows.
   *
   * The feed asks for this once and marks its own cards, which keeps the follow
   * state out of the cached tip payloads — those are shared between readers.
   */
  async followedIds(userId: string): Promise<string[]> {
    const rows = await prisma.tipFollow.findMany({
      where: { userId },
      select: { tipId: true },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });
    return rows.map((row) => row.tipId);
  }

  /**
   * The reader's record over a window, in the same shape as the published one,
   * so both screens render from the same component.
   */
  async record(userId: string, window: StatsWindow): Promise<StatisticsDTO> {
    const earliest = await prisma.tipFollow.findFirst({
      where: { userId, tip: { settledAt: { not: null } } },
      orderBy: { tip: { settledAt: 'asc' } },
      select: { tip: { select: { settledAt: true } } },
    });
    const range = windowRange(window, new Date(), earliest?.tip.settledAt ?? null);

    const rows = await prisma.tipFollow.findMany({
      where: {
        userId,
        tip: {
          settledAt: { gte: range.start, lte: range.end },
          outcome: { in: ['WON', 'LOST', 'VOID', 'HALF_WON', 'HALF_LOST'] },
        },
      },
      select: {
        stake: true,
        tip: {
          select: {
            id: true,
            product: true,
            outcome: true,
            odds: true,
            settledAt: true,
            publishAt: true,
            leagueId: true,
            marketType: true,
            league: { select: { name: true } },
            market: { select: { name: true } },
          },
        },
      },
    });

    const pendingTips = await prisma.tipFollow.count({
      where: { userId, tip: { outcome: { in: ['PENDING', 'LIVE'] } } },
    });

    const statTips: StatTip[] = rows.map(({ stake, tip }) => ({
      id: tip.id,
      product: tip.product as ProductCode,
      outcome: tip.outcome,
      odds: Number(tip.odds),
      // The reader's stake, not the published one: this record is their money.
      stake: Number(stake),
      settledAt: tip.settledAt,
      publishedAt: tip.publishAt,
      leagueId: tip.leagueId,
      leagueName: tip.league?.name ?? null,
      marketType: tip.marketType,
      marketName: tip.market?.name ?? null,
    }));

    const result = aggregate(statTips, {
      stake: env.STATISTICS_STAKE,
      timezone: env.DEFAULT_TIMEZONE,
    });

    return {
      product: 'ALL',
      window,
      periodStart: range.start.toISOString(),
      periodEnd: range.end.toISOString(),
      days: range.days,

      totalTips: result.totalTips,
      settledTips: result.settledTips,
      pendingTips,
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
  }
}

export const follows = new FollowService();
