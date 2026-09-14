import type { MarketType, ProductCode, TipOutcome } from '@profit-tips/types';
import { returnFactor, round2, round4, type SettlementOutcome } from './settlement.js';

/** A settled or pending tip, reduced to what the statistics engine needs. */
export interface StatTip {
  id: string;
  product: ProductCode;
  outcome: TipOutcome;
  odds: number;
  stake: number;
  /** Settlement timestamp; pending tips may omit it. */
  settledAt?: Date | string | null;
  /** Used to order the history when `settledAt` is missing. */
  publishedAt?: Date | string | null;
  leagueId?: string | null;
  leagueName?: string | null;
  marketType?: MarketType | null;
  marketName?: string | null;
}

export interface AggregateOptions {
  /** Flat stake used for the theoretical profit maths when a tip has none. */
  stake?: number;
  /** Locale-independent bucket labels come from the caller. */
  timezone?: string;
  now?: Date;
}

export interface SeriesPoint {
  date: string;
  profit: number;
  cumulativeProfit: number;
  tips: number;
  won: number;
  lost: number;
}

export interface Bucket {
  key: string;
  label: string;
  tips: number;
  won: number;
  lost: number;
  profit: number;
  roi: number;
  winRate: number;
  avgOdds: number;
}

export interface AggregateResult {
  totalTips: number;
  settledTips: number;
  pendingTips: number;
  won: number;
  lost: number;
  void: number;
  halfWon: number;
  halfLost: number;

  /** (won + halfWon/2) ÷ settled-excluding-void × 100 */
  winRate: number;
  /** profit ÷ turnover × 100 */
  roi: number;
  /** identical definition to `roi`; kept separate because both terms are used in the UI */
  yield: number;
  /** profit expressed as a multiple of one flat stake × 100 */
  returnOnStake: number;
  avgOdds: number;
  avgStake: number;
  totalStake: number;
  totalReturn: number;
  profit: number;

  bestStreak: number;
  worstStreak: number;
  currentStreak: number;

  byDay: SeriesPoint[];
  byWeek: SeriesPoint[];
  byMonth: SeriesPoint[];
  byLeague: Bucket[];
  byMarket: Bucket[];
  byProduct: Bucket[];
}

const SETTLED: TipOutcome[] = ['WON', 'LOST', 'VOID', 'HALF_WON', 'HALF_LOST'];

function isSettled(outcome: TipOutcome): outcome is TipOutcome & SettlementOutcome {
  return SETTLED.includes(outcome);
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayKey(date: Date, timezone?: string): string {
  if (!timezone) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** ISO week key, e.g. 2026-W37. */
function weekKey(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / 86_400_000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function monthKey(date: Date, timezone?: string): string {
  return dayKey(date, timezone).slice(0, 7);
}

interface Accumulator {
  tips: number;
  won: number;
  lost: number;
  stake: number;
  ret: number;
  oddsSum: number;
}

const emptyAcc = (): Accumulator => ({ tips: 0, won: 0, lost: 0, stake: 0, ret: 0, oddsSum: 0 });

function accumulate(acc: Accumulator, tip: StatTip, stake: number): void {
  const factor = returnFactor(tip.outcome as SettlementOutcome, tip.odds);
  acc.tips += 1;
  acc.stake += stake;
  acc.ret += stake * factor;
  acc.oddsSum += tip.odds;
  if (tip.outcome === 'WON' || tip.outcome === 'HALF_WON') acc.won += 1;
  if (tip.outcome === 'LOST' || tip.outcome === 'HALF_LOST') acc.lost += 1;
}

function toBucket(key: string, label: string, acc: Accumulator): Bucket {
  const profit = acc.ret - acc.stake;
  const decided = acc.won + acc.lost;
  return {
    key,
    label,
    tips: acc.tips,
    won: acc.won,
    lost: acc.lost,
    profit: round2(profit),
    roi: acc.stake > 0 ? round2((profit / acc.stake) * 100) : 0,
    winRate: decided > 0 ? round2((acc.won / decided) * 100) : 0,
    avgOdds: acc.tips > 0 ? round2(acc.oddsSum / acc.tips) : 0,
  };
}

function buildSeries(map: Map<string, Accumulator>): SeriesPoint[] {
  const keys = [...map.keys()].sort();
  let cumulative = 0;
  return keys.map((key) => {
    const acc = map.get(key) ?? emptyAcc();
    const profit = round2(acc.ret - acc.stake);
    cumulative = round2(cumulative + profit);
    return {
      date: key,
      profit,
      cumulativeProfit: cumulative,
      tips: acc.tips,
      won: acc.won,
      lost: acc.lost,
    };
  });
}

/**
 * Aggregates a list of tips into the full statistics payload.
 *
 * Pure and deterministic — the same input always yields the same numbers, which
 * is what allows the Combo paywall figures to be verified against the database.
 */
export function aggregate(tips: StatTip[], options: AggregateOptions = {}): AggregateResult {
  const flatStake = options.stake ?? 10;
  const timezone = options.timezone;

  const settled = tips.filter((tip) => isSettled(tip.outcome));
  const pending = tips.length - settled.length;

  const ordered = [...settled].sort((a, b) => {
    const left = toDate(a.settledAt) ?? toDate(a.publishedAt) ?? new Date(0);
    const right = toDate(b.settledAt) ?? toDate(b.publishedAt) ?? new Date(0);
    return left.getTime() - right.getTime();
  });

  const totals = emptyAcc();
  const counts = { WON: 0, LOST: 0, VOID: 0, HALF_WON: 0, HALF_LOST: 0 };

  const byDayMap = new Map<string, Accumulator>();
  const byWeekMap = new Map<string, Accumulator>();
  const byMonthMap = new Map<string, Accumulator>();
  const byLeagueMap = new Map<string, { label: string; acc: Accumulator }>();
  const byMarketMap = new Map<string, { label: string; acc: Accumulator }>();
  const byProductMap = new Map<string, { label: string; acc: Accumulator }>();

  let bestStreak = 0;
  let worstStreak = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let currentStreak = 0;

  for (const tip of ordered) {
    const stake = tip.stake > 0 ? tip.stake : flatStake;
    accumulate(totals, tip, stake);
    counts[tip.outcome as keyof typeof counts] += 1;

    const when = toDate(tip.settledAt) ?? toDate(tip.publishedAt);
    if (when) {
      for (const [map, key] of [
        [byDayMap, dayKey(when, timezone)],
        [byWeekMap, weekKey(when)],
        [byMonthMap, monthKey(when, timezone)],
      ] as [Map<string, Accumulator>, string][]) {
        const acc = map.get(key) ?? emptyAcc();
        accumulate(acc, tip, stake);
        map.set(key, acc);
      }
    }

    const leagueKey = tip.leagueId ?? 'unknown';
    const league = byLeagueMap.get(leagueKey) ?? {
      label: tip.leagueName ?? 'Unknown league',
      acc: emptyAcc(),
    };
    accumulate(league.acc, tip, stake);
    byLeagueMap.set(leagueKey, league);

    const marketKey = tip.marketType ?? 'OTHER';
    const market = byMarketMap.get(marketKey) ?? {
      label: tip.marketName ?? marketKey,
      acc: emptyAcc(),
    };
    accumulate(market.acc, tip, stake);
    byMarketMap.set(marketKey, market);

    const product = byProductMap.get(tip.product) ?? { label: tip.product, acc: emptyAcc() };
    accumulate(product.acc, tip, stake);
    byProductMap.set(tip.product, product);

    // streaks — VOID never breaks a run
    if (tip.outcome === 'WON' || tip.outcome === 'HALF_WON') {
      currentWinStreak += 1;
      currentLossStreak = 0;
      bestStreak = Math.max(bestStreak, currentWinStreak);
      currentStreak = currentWinStreak;
    } else if (tip.outcome === 'LOST' || tip.outcome === 'HALF_LOST') {
      currentLossStreak += 1;
      currentWinStreak = 0;
      worstStreak = Math.max(worstStreak, currentLossStreak);
      currentStreak = -currentLossStreak;
    }
  }

  const profit = round2(totals.ret - totals.stake);
  const decided = counts.WON + counts.LOST + counts.HALF_WON + counts.HALF_LOST;
  const weightedWins = counts.WON + counts.HALF_WON * 0.5;

  return {
    totalTips: tips.length,
    settledTips: settled.length,
    pendingTips: pending,
    won: counts.WON,
    lost: counts.LOST,
    void: counts.VOID,
    halfWon: counts.HALF_WON,
    halfLost: counts.HALF_LOST,

    winRate: decided > 0 ? round2((weightedWins / decided) * 100) : 0,
    roi: totals.stake > 0 ? round2((profit / totals.stake) * 100) : 0,
    yield: totals.stake > 0 ? round2((profit / totals.stake) * 100) : 0,
    returnOnStake: flatStake > 0 ? round2((profit / flatStake) * 100) : 0,
    avgOdds: settled.length > 0 ? round2(totals.oddsSum / settled.length) : 0,
    avgStake: settled.length > 0 ? round2(totals.stake / settled.length) : 0,
    totalStake: round2(totals.stake),
    totalReturn: round2(totals.ret),
    profit,

    bestStreak,
    worstStreak,
    currentStreak,

    byDay: buildSeries(byDayMap),
    byWeek: buildSeries(byWeekMap),
    byMonth: buildSeries(byMonthMap),
    byLeague: [...byLeagueMap.entries()]
      .map(([key, value]) => toBucket(key, value.label, value.acc))
      .sort((a, b) => b.profit - a.profit),
    byMarket: [...byMarketMap.entries()]
      .map(([key, value]) => toBucket(key, value.label, value.acc))
      .sort((a, b) => b.profit - a.profit),
    byProduct: [...byProductMap.entries()]
      .map(([key, value]) => toBucket(key, value.label, value.acc))
      .sort((a, b) => b.profit - a.profit),
  };
}

/** Number of days covered by a statistics window key. `null` = all time. */
export const WINDOW_DAYS: Record<string, number | null> = {
  D7: 7,
  D30: 30,
  D90: 90,
  M6: 182,
  M12: 365,
  ALL: null,
};

export function windowRange(
  window: string,
  now = new Date(),
  earliest?: Date | null,
): { start: Date; end: Date; days: number } {
  const days = WINDOW_DAYS[window] ?? null;
  const end = now;
  if (days === null) {
    const start = earliest ?? new Date(now.getTime() - 365 * 86_400_000);
    const spanned = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
    return { start, end, days: spanned };
  }
  return { start: new Date(now.getTime() - days * 86_400_000), end, days };
}

export { round2, round4 };
