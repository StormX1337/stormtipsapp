import { describe, expect, it } from 'vitest';
import { aggregate, windowRange, type StatTip } from '../src/aggregate.js';

const tip = (over: Partial<StatTip> & Pick<StatTip, 'outcome'>): StatTip => ({
  id: Math.random().toString(36).slice(2),
  product: 'VIP',
  odds: 2,
  stake: 10,
  settledAt: '2026-09-01T18:00:00.000Z',
  leagueId: 'league-1',
  leagueName: 'Premier League',
  marketType: 'MATCH_WINNER',
  marketName: 'Match winner',
  ...over,
});

describe('aggregate', () => {
  it('returns a zeroed result for an empty list', () => {
    const stats = aggregate([]);
    expect(stats.totalTips).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(stats.roi).toBe(0);
    expect(stats.profit).toBe(0);
    expect(stats.byDay).toEqual([]);
  });

  it('ignores pending tips in the settled maths but counts them', () => {
    const stats = aggregate([tip({ outcome: 'PENDING' }), tip({ outcome: 'WON' })]);
    expect(stats.totalTips).toBe(2);
    expect(stats.settledTips).toBe(1);
    expect(stats.pendingTips).toBe(1);
    expect(stats.profit).toBe(10);
  });

  it('computes win rate, ROI and profit', () => {
    const stats = aggregate([
      tip({ outcome: 'WON', odds: 2 }),
      tip({ outcome: 'WON', odds: 1.5 }),
      tip({ outcome: 'LOST', odds: 3 }),
      tip({ outcome: 'LOST', odds: 2 }),
    ]);
    // returns: 20 + 15 + 0 + 0 = 35, stake 40 → profit -5
    expect(stats.totalStake).toBe(40);
    expect(stats.totalReturn).toBe(35);
    expect(stats.profit).toBe(-5);
    expect(stats.roi).toBe(-12.5);
    expect(stats.winRate).toBe(50);
    expect(stats.avgOdds).toBe(2.13);
  });

  it('excludes void tips from the win rate but keeps them in the tip count', () => {
    const stats = aggregate([
      tip({ outcome: 'WON' }),
      tip({ outcome: 'VOID' }),
      tip({ outcome: 'LOST' }),
    ]);
    expect(stats.void).toBe(1);
    expect(stats.winRate).toBe(50);
    expect(stats.profit).toBe(0); // +10 −10 +0
  });

  it('counts a half win as half a win in the win rate', () => {
    const stats = aggregate([tip({ outcome: 'HALF_WON' }), tip({ outcome: 'LOST' })]);
    expect(stats.winRate).toBe(25);
  });

  it('computes return on stake as a multiple of a single flat stake', () => {
    const stats = aggregate(
      Array.from({ length: 10 }, () => tip({ outcome: 'WON', odds: 2, stake: 10 })),
      { stake: 10 },
    );
    expect(stats.profit).toBe(100);
    expect(stats.returnOnStake).toBe(1000);
    expect(stats.roi).toBe(100);
  });

  it('tracks best, worst and current streaks, skipping void tips', () => {
    const stats = aggregate([
      tip({ outcome: 'WON', settledAt: '2026-09-01T10:00:00Z' }),
      tip({ outcome: 'WON', settledAt: '2026-09-02T10:00:00Z' }),
      tip({ outcome: 'VOID', settledAt: '2026-09-03T10:00:00Z' }),
      tip({ outcome: 'WON', settledAt: '2026-09-04T10:00:00Z' }),
      tip({ outcome: 'LOST', settledAt: '2026-09-05T10:00:00Z' }),
      tip({ outcome: 'LOST', settledAt: '2026-09-06T10:00:00Z' }),
    ]);
    expect(stats.bestStreak).toBe(3);
    expect(stats.worstStreak).toBe(2);
    expect(stats.currentStreak).toBe(-2);
  });

  it('builds a cumulative daily series in chronological order', () => {
    const stats = aggregate([
      tip({ outcome: 'WON', settledAt: '2026-09-02T10:00:00Z', odds: 2, stake: 10 }),
      tip({ outcome: 'LOST', settledAt: '2026-09-01T10:00:00Z', odds: 2, stake: 10 }),
      tip({ outcome: 'WON', settledAt: '2026-09-02T20:00:00Z', odds: 2, stake: 10 }),
    ]);
    expect(stats.byDay.map((point) => point.date)).toEqual(['2026-09-01', '2026-09-02']);
    expect(stats.byDay[0]?.profit).toBe(-10);
    expect(stats.byDay[1]?.profit).toBe(20);
    expect(stats.byDay[1]?.cumulativeProfit).toBe(10);
  });

  it('groups by league, market and product, sorted by profit', () => {
    const stats = aggregate([
      tip({ outcome: 'WON', leagueId: 'a', leagueName: 'A', product: 'VIP' }),
      tip({ outcome: 'LOST', leagueId: 'b', leagueName: 'B', product: 'FREE' }),
      tip({ outcome: 'WON', leagueId: 'a', leagueName: 'A', product: 'VIP' }),
    ]);
    expect(stats.byLeague[0]?.key).toBe('a');
    expect(stats.byLeague[0]?.profit).toBe(20);
    expect(stats.byLeague[1]?.profit).toBe(-10);
    expect(stats.byProduct.map((bucket) => bucket.key)).toEqual(['VIP', 'FREE']);
    expect(stats.byMarket[0]?.key).toBe('MATCH_WINNER');
  });

  it('groups by ISO week and by month', () => {
    const stats = aggregate([
      tip({ outcome: 'WON', settledAt: '2026-09-07T10:00:00Z' }),
      tip({ outcome: 'WON', settledAt: '2026-10-07T10:00:00Z' }),
    ]);
    expect(stats.byMonth.map((point) => point.date)).toEqual(['2026-09', '2026-10']);
    expect(stats.byWeek).toHaveLength(2);
    expect(stats.byWeek[0]?.date).toMatch(/^2026-W\d{2}$/);
  });

  it('falls back to the flat stake when a tip has none', () => {
    const stats = aggregate([tip({ outcome: 'WON', stake: 0, odds: 3 })], { stake: 25 });
    expect(stats.totalStake).toBe(25);
    expect(stats.profit).toBe(50);
  });
});

describe('windowRange', () => {
  const now = new Date('2026-09-13T12:00:00.000Z');

  it('maps every window key to a day count', () => {
    expect(windowRange('D7', now).days).toBe(7);
    expect(windowRange('D30', now).days).toBe(30);
    expect(windowRange('M12', now).days).toBe(365);
  });

  it('spans from the earliest record for the ALL window', () => {
    const range = windowRange('ALL', now, new Date('2026-03-13T12:00:00.000Z'));
    expect(range.days).toBe(184);
    expect(range.start.toISOString()).toBe('2026-03-13T12:00:00.000Z');
  });
});
