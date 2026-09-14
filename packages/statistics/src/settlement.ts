import { AppError, ErrorCode, MarketType, SelectionKey } from '@storm-tips/types';

/** The settled outcome of a single selection. */
export type SettlementOutcome = 'WON' | 'LOST' | 'VOID' | 'HALF_WON' | 'HALF_LOST';

/** Outcome of one whole/half line before quarter-line recombination. */
type BaseOutcome = 'WON' | 'LOST' | 'VOID';

export interface MatchResult {
  homeScore: number;
  awayScore: number;
  htHomeScore?: number | null;
  htAwayScore?: number | null;
  homeCorners?: number | null;
  awayCorners?: number | null;
  homeCards?: number | null;
  awayCards?: number | null;
}

export interface SelectionInput {
  marketType: MarketType;
  /** Machine readable key, e.g. HOME / OVER / BTTS_YES, or "2-1" for correct score. */
  selectionKey: string;
  /** Numeric line for totals and handicaps. */
  line?: number | null;
}

const EPSILON = 1e-9;

/** 0.25 / 0.75 / 1.25 … — the stake splits across two adjacent lines. */
export function isQuarterLine(line: number): boolean {
  const scaled = Math.round(Math.abs(line) * 100);
  return scaled % 50 === 25;
}

/** 0.5 / 1.5 / 2.5 … — no push is possible. */
export function isHalfLine(line: number): boolean {
  const scaled = Math.round(Math.abs(line) * 100);
  return scaled % 100 === 50;
}

/** 0 / 1 / 2 … — an exact hit is a push (VOID). */
export function isWholeLine(line: number): boolean {
  return Math.round(Math.abs(line) * 100) % 100 === 0;
}

function compare(a: number, b: number): -1 | 0 | 1 {
  if (Math.abs(a - b) < EPSILON) return 0;
  return a > b ? 1 : -1;
}

/**
 * Settles a quarter line by splitting the stake across the two adjacent
 * half/whole lines and recombining the two halves.
 *
 *   WON  + VOID → HALF_WON
 *   LOST + VOID → HALF_LOST
 */
function settleSplit(line: number, settleAt: (line: number) => BaseOutcome): SettlementOutcome {
  if (!isQuarterLine(line)) return settleAt(line);
  // A quarter line always splits into the two lines a quarter goal either side.
  const a = settleAt(round2(line - 0.25));
  const b = settleAt(round2(line + 0.25));
  return combineHalves(a, b);
}

export function combineHalves(a: BaseOutcome, b: BaseOutcome): SettlementOutcome {
  if (a === 'WON' && b === 'WON') return 'WON';
  if (a === 'LOST' && b === 'LOST') return 'LOST';
  if (a === 'VOID' && b === 'VOID') return 'VOID';
  if ((a === 'WON' && b === 'VOID') || (a === 'VOID' && b === 'WON')) return 'HALF_WON';
  if ((a === 'LOST' && b === 'VOID') || (a === 'VOID' && b === 'LOST')) return 'HALF_LOST';
  // WON + LOST cannot occur on adjacent lines; treat defensively as a push.
  return 'VOID';
}

function requireLine(selection: SelectionInput): number {
  if (selection.line === null || selection.line === undefined || Number.isNaN(selection.line)) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      `Market ${selection.marketType} requires a numeric line`,
    );
  }
  return selection.line;
}

function totalOver(total: number, line: number): BaseOutcome {
  const cmp = compare(total, line);
  if (cmp === 0) return 'VOID';
  return cmp > 0 ? 'WON' : 'LOST';
}

function invertSettled(outcome: SettlementOutcome): SettlementOutcome {
  switch (outcome) {
    case 'WON':
      return 'LOST';
    case 'LOST':
      return 'WON';
    case 'HALF_WON':
      return 'HALF_LOST';
    case 'HALF_LOST':
      return 'HALF_WON';
    default:
      return 'VOID';
  }
}

function settleTotals(total: number, line: number, over: boolean): SettlementOutcome {
  const outcome = settleSplit(line, (l) => totalOver(total, l));
  return over ? outcome : invertSettled(outcome);
}

/** Asian handicap: the line is applied to the *selected* team. */
function settleAsianHandicap(
  teamScore: number,
  opponentScore: number,
  line: number,
): SettlementOutcome {
  return settleSplit(line, (l) => {
    const cmp = compare(teamScore + l, opponentScore);
    if (cmp === 0) return 'VOID';
    return cmp > 0 ? 'WON' : 'LOST';
  });
}

/**
 * Settles one selection against a final result.
 *
 * @throws AppError(UNSUPPORTED_MARKET) for markets that must be settled by a human.
 */
export function settleSelection(selection: SelectionInput, result: MatchResult): SettlementOutcome {
  const { homeScore, awayScore } = result;
  const key = selection.selectionKey;
  const total = homeScore + awayScore;

  switch (selection.marketType) {
    case MarketType.MATCH_WINNER: {
      const cmp = compare(homeScore, awayScore);
      if (key === SelectionKey.HOME) return cmp > 0 ? 'WON' : 'LOST';
      if (key === SelectionKey.AWAY) return cmp < 0 ? 'WON' : 'LOST';
      if (key === SelectionKey.DRAW) return cmp === 0 ? 'WON' : 'LOST';
      throw unsupportedSelection(selection);
    }

    case MarketType.DOUBLE_CHANCE: {
      const cmp = compare(homeScore, awayScore);
      if (key === SelectionKey.HOME_OR_DRAW) return cmp >= 0 ? 'WON' : 'LOST';
      if (key === SelectionKey.AWAY_OR_DRAW) return cmp <= 0 ? 'WON' : 'LOST';
      if (key === SelectionKey.HOME_OR_AWAY) return cmp !== 0 ? 'WON' : 'LOST';
      throw unsupportedSelection(selection);
    }

    case MarketType.DRAW_NO_BET: {
      const cmp = compare(homeScore, awayScore);
      if (cmp === 0) return 'VOID';
      if (key === SelectionKey.HOME) return cmp > 0 ? 'WON' : 'LOST';
      if (key === SelectionKey.AWAY) return cmp < 0 ? 'WON' : 'LOST';
      throw unsupportedSelection(selection);
    }

    case MarketType.OVER_UNDER: {
      const line = requireLine(selection);
      if (key === SelectionKey.OVER) return settleTotals(total, line, true);
      if (key === SelectionKey.UNDER) return settleTotals(total, line, false);
      throw unsupportedSelection(selection);
    }

    case MarketType.HALF_OVER_UNDER: {
      const line = requireLine(selection);
      if (result.htHomeScore === null || result.htHomeScore === undefined) {
        throw new AppError(
          ErrorCode.UNSUPPORTED_MARKET,
          'Half-time score is not available for this event',
        );
      }
      const htTotal = (result.htHomeScore ?? 0) + (result.htAwayScore ?? 0);
      if (key === SelectionKey.HT_OVER) return settleTotals(htTotal, line, true);
      if (key === SelectionKey.HT_UNDER) return settleTotals(htTotal, line, false);
      throw unsupportedSelection(selection);
    }

    case MarketType.TEAM_TOTAL: {
      const line = requireLine(selection);
      if (key === SelectionKey.HOME_OVER) return settleTotals(homeScore, line, true);
      if (key === SelectionKey.HOME_UNDER) return settleTotals(homeScore, line, false);
      if (key === SelectionKey.AWAY_OVER) return settleTotals(awayScore, line, true);
      if (key === SelectionKey.AWAY_UNDER) return settleTotals(awayScore, line, false);
      throw unsupportedSelection(selection);
    }

    case MarketType.ASIAN_HANDICAP: {
      const line = requireLine(selection);
      if (key === SelectionKey.HOME) return settleAsianHandicap(homeScore, awayScore, line);
      if (key === SelectionKey.AWAY) return settleAsianHandicap(awayScore, homeScore, line);
      throw unsupportedSelection(selection);
    }

    case MarketType.EUROPEAN_HANDICAP: {
      // The line is always applied to the home team; a tie after adjustment is a DRAW win.
      const line = requireLine(selection);
      const cmp = compare(homeScore + line, awayScore);
      if (key === SelectionKey.HOME) return cmp > 0 ? 'WON' : 'LOST';
      if (key === SelectionKey.DRAW) return cmp === 0 ? 'WON' : 'LOST';
      if (key === SelectionKey.AWAY) return cmp < 0 ? 'WON' : 'LOST';
      throw unsupportedSelection(selection);
    }

    case MarketType.BTTS: {
      const both = homeScore > 0 && awayScore > 0;
      if (key === SelectionKey.BTTS_YES) return both ? 'WON' : 'LOST';
      if (key === SelectionKey.BTTS_NO) return both ? 'LOST' : 'WON';
      throw unsupportedSelection(selection);
    }

    case MarketType.CORRECT_SCORE: {
      const expected = parseScoreKey(key);
      if (!expected) throw unsupportedSelection(selection);
      return expected.home === homeScore && expected.away === awayScore ? 'WON' : 'LOST';
    }

    case MarketType.HT_FT: {
      if (result.htHomeScore === null || result.htHomeScore === undefined) {
        throw new AppError(
          ErrorCode.UNSUPPORTED_MARKET,
          'Half-time score is not available for this event',
        );
      }
      const parts = key.split('_');
      if (parts.length !== 2) throw unsupportedSelection(selection);
      const htSide = sideOf(result.htHomeScore ?? 0, result.htAwayScore ?? 0);
      const ftSide = sideOf(homeScore, awayScore);
      return parts[0] === htSide && parts[1] === ftSide ? 'WON' : 'LOST';
    }

    case MarketType.CORNERS: {
      const line = requireLine(selection);
      if (result.homeCorners === null || result.homeCorners === undefined) {
        throw new AppError(ErrorCode.UNSUPPORTED_MARKET, 'Corner data is not available');
      }
      const corners = (result.homeCorners ?? 0) + (result.awayCorners ?? 0);
      if (key === SelectionKey.OVER) return settleTotals(corners, line, true);
      if (key === SelectionKey.UNDER) return settleTotals(corners, line, false);
      throw unsupportedSelection(selection);
    }

    case MarketType.CARDS: {
      const line = requireLine(selection);
      if (result.homeCards === null || result.homeCards === undefined) {
        throw new AppError(ErrorCode.UNSUPPORTED_MARKET, 'Card data is not available');
      }
      const cards = (result.homeCards ?? 0) + (result.awayCards ?? 0);
      if (key === SelectionKey.OVER) return settleTotals(cards, line, true);
      if (key === SelectionKey.UNDER) return settleTotals(cards, line, false);
      throw unsupportedSelection(selection);
    }

    case MarketType.PLAYER_PROP:
    case MarketType.OTHER:
    default:
      throw new AppError(
        ErrorCode.UNSUPPORTED_MARKET,
        `Market ${selection.marketType} must be settled manually`,
        { marketType: selection.marketType },
      );
  }
}

function sideOf(home: number, away: number): 'HOME' | 'DRAW' | 'AWAY' {
  const cmp = compare(home, away);
  return cmp > 0 ? 'HOME' : cmp < 0 ? 'AWAY' : 'DRAW';
}

function parseScoreKey(key: string): { home: number; away: number } | null {
  const match = /^(\d{1,2})[-:](\d{1,2})$/.exec(key.trim());
  if (!match) return null;
  return { home: Number(match[1]), away: Number(match[2]) };
}

function unsupportedSelection(selection: SelectionInput): AppError {
  return new AppError(
    ErrorCode.UNSUPPORTED_MARKET,
    `Selection "${selection.selectionKey}" is not valid for market ${selection.marketType}`,
    { selection },
  );
}

/** Money returned per 1 unit staked. */
export function returnFactor(outcome: SettlementOutcome, odds: number): number {
  switch (outcome) {
    case 'WON':
      return odds;
    case 'LOST':
      return 0;
    case 'VOID':
      return 1;
    case 'HALF_WON':
      return 1 + (odds - 1) / 2;
    case 'HALF_LOST':
      return 0.5;
    default:
      return 1;
  }
}

/** Net profit for a settled selection. */
export function profitFor(outcome: SettlementOutcome, odds: number, stake: number): number {
  return round2(stake * (returnFactor(outcome, odds) - 1));
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export interface ComboLeg {
  outcome: SettlementOutcome;
  odds: number;
}

export interface ComboSettlement {
  outcome: SettlementOutcome;
  returnFactor: number;
  profit: number;
  totalOdds: number;
}

/**
 * Settles an accumulator by multiplying the per-leg return factors, which is how
 * a bookmaker settles a combo containing void / half-won legs.
 *
 *   factor 0       → LOST
 *   factor 1       → VOID (every leg pushed)
 *   factor > 1     → WON
 *   0 < factor < 1 → HALF_LOST (money back, but less than the stake)
 */
export function settleCombo(legs: ComboLeg[], stake: number): ComboSettlement {
  if (legs.length === 0) {
    return { outcome: 'VOID', returnFactor: 1, profit: 0, totalOdds: 1 };
  }
  const factor = legs.reduce((acc, leg) => acc * returnFactor(leg.outcome, leg.odds), 1);
  const totalOdds = round4(legs.reduce((acc, leg) => acc * leg.odds, 1));
  const rounded = round4(factor);

  let outcome: SettlementOutcome;
  if (rounded <= 0) outcome = 'LOST';
  else if (Math.abs(rounded - 1) < EPSILON) outcome = 'VOID';
  else if (rounded > 1) outcome = 'WON';
  else outcome = 'HALF_LOST';

  return { outcome, returnFactor: rounded, profit: round2(stake * (rounded - 1)), totalOdds };
}

/** Combined decimal odds of an accumulator. */
export function comboOdds(odds: number[]): number {
  return round4(odds.reduce((acc, value) => acc * value, 1));
}
