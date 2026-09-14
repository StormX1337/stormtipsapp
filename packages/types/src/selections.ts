import { MarketType } from './enums.js';

/**
 * Machine-readable selection keys consumed by the settlement engine.
 * The UI never renders these directly — every tip also carries a
 * human readable `selectionLabel`.
 */
export const SelectionKey = {
  // 1X2
  HOME: 'HOME',
  DRAW: 'DRAW',
  AWAY: 'AWAY',
  // double chance
  HOME_OR_DRAW: 'HOME_OR_DRAW',
  AWAY_OR_DRAW: 'AWAY_OR_DRAW',
  HOME_OR_AWAY: 'HOME_OR_AWAY',
  // totals
  OVER: 'OVER',
  UNDER: 'UNDER',
  // team totals
  HOME_OVER: 'HOME_OVER',
  HOME_UNDER: 'HOME_UNDER',
  AWAY_OVER: 'AWAY_OVER',
  AWAY_UNDER: 'AWAY_UNDER',
  // both teams to score
  BTTS_YES: 'BTTS_YES',
  BTTS_NO: 'BTTS_NO',
  // first half totals
  HT_OVER: 'HT_OVER',
  HT_UNDER: 'HT_UNDER',
} as const;
export type SelectionKey = (typeof SelectionKey)[keyof typeof SelectionKey];

/** Which selection keys are legal for a given market. */
export const MARKET_SELECTIONS: Record<MarketType, readonly string[]> = {
  MATCH_WINNER: [SelectionKey.HOME, SelectionKey.DRAW, SelectionKey.AWAY],
  DOUBLE_CHANCE: [SelectionKey.HOME_OR_DRAW, SelectionKey.AWAY_OR_DRAW, SelectionKey.HOME_OR_AWAY],
  DRAW_NO_BET: [SelectionKey.HOME, SelectionKey.AWAY],
  OVER_UNDER: [SelectionKey.OVER, SelectionKey.UNDER],
  TEAM_TOTAL: [
    SelectionKey.HOME_OVER,
    SelectionKey.HOME_UNDER,
    SelectionKey.AWAY_OVER,
    SelectionKey.AWAY_UNDER,
  ],
  ASIAN_HANDICAP: [SelectionKey.HOME, SelectionKey.AWAY],
  EUROPEAN_HANDICAP: [SelectionKey.HOME, SelectionKey.DRAW, SelectionKey.AWAY],
  BTTS: [SelectionKey.BTTS_YES, SelectionKey.BTTS_NO],
  CORRECT_SCORE: [], // free-form "2-1"
  HT_FT: [], // free-form "HOME_DRAW"
  HALF_OVER_UNDER: [SelectionKey.HT_OVER, SelectionKey.HT_UNDER],
  CORNERS: [SelectionKey.OVER, SelectionKey.UNDER],
  CARDS: [SelectionKey.OVER, SelectionKey.UNDER],
  PLAYER_PROP: [], // settled manually
  OTHER: [], // settled manually
};

/** Markets that require a numeric line. */
export const MARKETS_WITH_LINE: MarketType[] = [
  MarketType.OVER_UNDER,
  MarketType.TEAM_TOTAL,
  MarketType.ASIAN_HANDICAP,
  MarketType.EUROPEAN_HANDICAP,
  MarketType.HALF_OVER_UNDER,
  MarketType.CORNERS,
  MarketType.CARDS,
];

/** Markets the automatic result engine cannot settle without a human. */
export const MANUAL_SETTLEMENT_MARKETS: MarketType[] = [MarketType.PLAYER_PROP, MarketType.OTHER];

export function marketRequiresLine(market: MarketType): boolean {
  return MARKETS_WITH_LINE.includes(market);
}

export function isValidSelection(market: MarketType, selectionKey: string): boolean {
  const allowed = MARKET_SELECTIONS[market];
  if (allowed.length === 0) return selectionKey.trim().length > 0;
  return allowed.includes(selectionKey);
}
