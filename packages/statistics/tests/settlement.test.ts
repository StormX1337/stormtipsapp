import { describe, expect, it } from 'vitest';
import { MarketType } from '@storm-tips/types';
import {
  comboOdds,
  isHalfLine,
  isQuarterLine,
  isWholeLine,
  profitFor,
  returnFactor,
  settleCombo,
  settleSelection,
  type MatchResult,
} from '../src/settlement.js';

const result = (home: number, away: number, extra: Partial<MatchResult> = {}): MatchResult => ({
  homeScore: home,
  awayScore: away,
  ...extra,
});

describe('line classification', () => {
  it('detects whole, half and quarter lines', () => {
    expect(isWholeLine(0)).toBe(true);
    expect(isWholeLine(2)).toBe(true);
    expect(isWholeLine(-1)).toBe(true);
    expect(isHalfLine(2.5)).toBe(true);
    expect(isHalfLine(-0.5)).toBe(true);
    expect(isQuarterLine(0.25)).toBe(true);
    expect(isQuarterLine(-0.75)).toBe(true);
    expect(isQuarterLine(4.25)).toBe(true);
    expect(isQuarterLine(2.5)).toBe(false);
  });
});

describe('MATCH_WINNER', () => {
  const cases: [string, number, number, string][] = [
    ['HOME', 2, 1, 'WON'],
    ['HOME', 1, 1, 'LOST'],
    ['DRAW', 1, 1, 'WON'],
    ['DRAW', 0, 1, 'LOST'],
    ['AWAY', 0, 3, 'WON'],
    ['AWAY', 3, 0, 'LOST'],
  ];
  it.each(cases)('%s %i-%i → %s', (key, home, away, expected) => {
    expect(
      settleSelection(
        { marketType: MarketType.MATCH_WINNER, selectionKey: key },
        result(home, away),
      ),
    ).toBe(expected);
  });
});

describe('DOUBLE_CHANCE', () => {
  it('settles "away win or draw" exactly like the reference tip', () => {
    // Manchester United vs Manchester City — AWAY_OR_DRAW @ 1.33
    const selection = { marketType: MarketType.DOUBLE_CHANCE, selectionKey: 'AWAY_OR_DRAW' };
    expect(settleSelection(selection, result(0, 2))).toBe('WON');
    expect(settleSelection(selection, result(1, 1))).toBe('WON');
    expect(settleSelection(selection, result(3, 1))).toBe('LOST');
  });

  it('settles the other two double chance legs', () => {
    expect(
      settleSelection(
        { marketType: MarketType.DOUBLE_CHANCE, selectionKey: 'HOME_OR_DRAW' },
        result(1, 1),
      ),
    ).toBe('WON');
    expect(
      settleSelection(
        { marketType: MarketType.DOUBLE_CHANCE, selectionKey: 'HOME_OR_AWAY' },
        result(1, 1),
      ),
    ).toBe('LOST');
  });
});

describe('DRAW_NO_BET', () => {
  it('pushes on a draw', () => {
    expect(
      settleSelection({ marketType: MarketType.DRAW_NO_BET, selectionKey: 'HOME' }, result(2, 2)),
    ).toBe('VOID');
  });
});

describe('OVER_UNDER', () => {
  it('settles half lines with no push', () => {
    const over = { marketType: MarketType.OVER_UNDER, selectionKey: 'OVER', line: 2.5 };
    expect(settleSelection(over, result(2, 1))).toBe('WON');
    expect(settleSelection(over, result(1, 1))).toBe('LOST');
  });

  it('pushes on an exact whole line', () => {
    const under = { marketType: MarketType.OVER_UNDER, selectionKey: 'UNDER', line: 3 };
    expect(settleSelection(under, result(2, 1))).toBe('VOID');
    expect(settleSelection(under, result(1, 1))).toBe('WON');
    expect(settleSelection(under, result(3, 1))).toBe('LOST');
  });

  it('settles the "UNDER 4.0, 4.5" split line from the reference screenshot', () => {
    // Alternative goal line UNDER 4.0 / 4.5 is the quarter line 4.25
    const under = { marketType: MarketType.OVER_UNDER, selectionKey: 'UNDER', line: 4.25 };
    expect(settleSelection(under, result(1, 2))).toBe('WON'); // 3 goals
    expect(settleSelection(under, result(2, 2))).toBe('HALF_WON'); // exactly 4 goals
    expect(settleSelection(under, result(3, 2))).toBe('LOST'); // 5 goals
  });

  it('settles the "UNDER 3.5, 4.0" split line', () => {
    const under = { marketType: MarketType.OVER_UNDER, selectionKey: 'UNDER', line: 3.75 };
    expect(settleSelection(under, result(1, 2))).toBe('WON'); // 3
    expect(settleSelection(under, result(2, 2))).toBe('HALF_LOST'); // exactly 4
    expect(settleSelection(under, result(3, 2))).toBe('LOST'); // 5
  });

  it('mirrors OVER and UNDER on quarter lines', () => {
    const over = { marketType: MarketType.OVER_UNDER, selectionKey: 'OVER', line: 2.25 };
    expect(settleSelection(over, result(1, 1))).toBe('HALF_LOST'); // exactly 2
    expect(settleSelection(over, result(2, 1))).toBe('WON');
    expect(settleSelection(over, result(0, 1))).toBe('LOST');
  });
});

describe('ASIAN_HANDICAP', () => {
  it('settles a whole-line handicap with a push', () => {
    const home = { marketType: MarketType.ASIAN_HANDICAP, selectionKey: 'HOME', line: -1 };
    expect(settleSelection(home, result(2, 1))).toBe('VOID');
    expect(settleSelection(home, result(3, 1))).toBe('WON');
    expect(settleSelection(home, result(1, 1))).toBe('LOST');
  });

  it('settles the "-1.0, -1.5 BAYERN" split line from the reference screenshot', () => {
    // Elversberg vs Bayern — Bayern are the away side, line -1.25
    const bayern = { marketType: MarketType.ASIAN_HANDICAP, selectionKey: 'AWAY', line: -1.25 };
    expect(settleSelection(bayern, result(0, 3))).toBe('WON'); // wins by 3
    expect(settleSelection(bayern, result(1, 2))).toBe('HALF_LOST'); // wins by exactly 1
    expect(settleSelection(bayern, result(1, 1))).toBe('LOST');
  });

  it('settles -0.75 as half win when the team wins by one', () => {
    const selection = { marketType: MarketType.ASIAN_HANDICAP, selectionKey: 'HOME', line: -0.75 };
    expect(settleSelection(selection, result(1, 0))).toBe('HALF_WON');
    expect(settleSelection(selection, result(2, 0))).toBe('WON');
    expect(settleSelection(selection, result(0, 0))).toBe('LOST');
  });

  it('settles +0.25 as half loss on a draw', () => {
    const selection = { marketType: MarketType.ASIAN_HANDICAP, selectionKey: 'AWAY', line: 0.25 };
    expect(settleSelection(selection, result(1, 1))).toBe('HALF_WON');
    expect(settleSelection(selection, result(2, 1))).toBe('LOST');
    expect(settleSelection(selection, result(1, 2))).toBe('WON');
  });

  it('settles -0.25 as half loss on a draw', () => {
    const selection = { marketType: MarketType.ASIAN_HANDICAP, selectionKey: 'HOME', line: -0.25 };
    expect(settleSelection(selection, result(1, 1))).toBe('HALF_LOST');
    expect(settleSelection(selection, result(2, 1))).toBe('WON');
  });
});

describe('EUROPEAN_HANDICAP', () => {
  it('has no push and applies the line to the home team', () => {
    const away = { marketType: MarketType.EUROPEAN_HANDICAP, selectionKey: 'AWAY', line: 1 };
    expect(settleSelection(away, result(0, 2))).toBe('WON');
    const draw = { marketType: MarketType.EUROPEAN_HANDICAP, selectionKey: 'DRAW', line: 1 };
    expect(settleSelection(draw, result(0, 1))).toBe('WON');
  });
});

describe('other markets', () => {
  it('settles BTTS', () => {
    expect(
      settleSelection({ marketType: MarketType.BTTS, selectionKey: 'BTTS_YES' }, result(1, 1)),
    ).toBe('WON');
    expect(
      settleSelection({ marketType: MarketType.BTTS, selectionKey: 'BTTS_NO' }, result(1, 0)),
    ).toBe('WON');
  });

  it('settles team totals', () => {
    const sel = { marketType: MarketType.TEAM_TOTAL, selectionKey: 'HOME_OVER', line: 1.5 };
    expect(settleSelection(sel, result(2, 0))).toBe('WON');
    expect(settleSelection(sel, result(1, 5))).toBe('LOST');
  });

  it('settles correct score', () => {
    expect(
      settleSelection({ marketType: MarketType.CORRECT_SCORE, selectionKey: '2-1' }, result(2, 1)),
    ).toBe('WON');
    expect(
      settleSelection({ marketType: MarketType.CORRECT_SCORE, selectionKey: '2-1' }, result(1, 2)),
    ).toBe('LOST');
  });

  it('settles half-time/full-time', () => {
    const sel = { marketType: MarketType.HT_FT, selectionKey: 'DRAW_HOME' };
    expect(settleSelection(sel, result(2, 1, { htHomeScore: 0, htAwayScore: 0 }))).toBe('WON');
    expect(settleSelection(sel, result(2, 1, { htHomeScore: 1, htAwayScore: 0 }))).toBe('LOST');
  });

  it('settles first half totals', () => {
    const sel = { marketType: MarketType.HALF_OVER_UNDER, selectionKey: 'HT_OVER', line: 0.5 };
    expect(settleSelection(sel, result(3, 0, { htHomeScore: 1, htAwayScore: 0 }))).toBe('WON');
    expect(settleSelection(sel, result(3, 0, { htHomeScore: 0, htAwayScore: 0 }))).toBe('LOST');
  });

  it('settles corners and cards when the data is present', () => {
    expect(
      settleSelection(
        { marketType: MarketType.CORNERS, selectionKey: 'OVER', line: 9.5 },
        result(1, 0, { homeCorners: 6, awayCorners: 5 }),
      ),
    ).toBe('WON');
    expect(
      settleSelection(
        { marketType: MarketType.CARDS, selectionKey: 'UNDER', line: 4.5 },
        result(1, 0, { homeCards: 2, awayCards: 1 }),
      ),
    ).toBe('WON');
  });

  it('refuses to auto-settle manual markets', () => {
    expect(() =>
      settleSelection({ marketType: MarketType.PLAYER_PROP, selectionKey: 'ANY' }, result(1, 0)),
    ).toThrowError(/manually/);
  });

  it('rejects a market that needs a line without one', () => {
    expect(() =>
      settleSelection({ marketType: MarketType.OVER_UNDER, selectionKey: 'OVER' }, result(1, 0)),
    ).toThrowError(/requires a numeric line/);
  });

  it('rejects an invalid selection for a market', () => {
    expect(() =>
      settleSelection({ marketType: MarketType.BTTS, selectionKey: 'HOME' }, result(1, 0)),
    ).toThrowError(/not valid for market/);
  });
});

describe('return factors and profit', () => {
  it('returns the documented factor per outcome', () => {
    expect(returnFactor('WON', 2.5)).toBe(2.5);
    expect(returnFactor('LOST', 2.5)).toBe(0);
    expect(returnFactor('VOID', 2.5)).toBe(1);
    expect(returnFactor('HALF_WON', 2.5)).toBe(1.75);
    expect(returnFactor('HALF_LOST', 2.5)).toBe(0.5);
  });

  it('computes half-win profit as stake/2 × (odds − 1)', () => {
    // The canonical example: 100 @ 1.95 on -0.75, team wins by one
    expect(profitFor('HALF_WON', 1.95, 100)).toBe(47.5);
    expect(profitFor('HALF_LOST', 1.95, 100)).toBe(-50);
    expect(profitFor('WON', 1.33, 10)).toBe(3.3);
    expect(profitFor('LOST', 1.33, 10)).toBe(-10);
    expect(profitFor('VOID', 1.33, 10)).toBe(0);
  });
});

describe('combo settlement', () => {
  it('multiplies odds', () => {
    expect(comboOdds([1.5, 1.7, 1.8])).toBeCloseTo(4.59, 2);
  });

  it('wins when every leg wins', () => {
    const settlement = settleCombo(
      [
        { outcome: 'WON', odds: 1.5 },
        { outcome: 'WON', odds: 1.7 },
        { outcome: 'WON', odds: 1.8 },
      ],
      10,
    );
    expect(settlement.outcome).toBe('WON');
    expect(settlement.totalOdds).toBeCloseTo(4.59, 2);
    expect(settlement.profit).toBeCloseTo(35.9, 1);
  });

  it('loses when any leg loses', () => {
    const settlement = settleCombo(
      [
        { outcome: 'WON', odds: 1.5 },
        { outcome: 'LOST', odds: 1.7 },
      ],
      10,
    );
    expect(settlement.outcome).toBe('LOST');
    expect(settlement.profit).toBe(-10);
  });

  it('drops a void leg out of the accumulator', () => {
    const settlement = settleCombo(
      [
        { outcome: 'WON', odds: 2 },
        { outcome: 'VOID', odds: 1.7 },
      ],
      10,
    );
    expect(settlement.outcome).toBe('WON');
    expect(settlement.returnFactor).toBe(2);
    expect(settlement.profit).toBe(10);
  });

  it('pushes when every leg pushes', () => {
    const settlement = settleCombo(
      [
        { outcome: 'VOID', odds: 2 },
        { outcome: 'VOID', odds: 1.7 },
      ],
      10,
    );
    expect(settlement.outcome).toBe('VOID');
    expect(settlement.profit).toBe(0);
  });

  it('halves the winning leg when one leg is a half win', () => {
    const settlement = settleCombo(
      [
        { outcome: 'HALF_WON', odds: 2 },
        { outcome: 'WON', odds: 1.5 },
      ],
      10,
    );
    expect(settlement.returnFactor).toBeCloseTo(2.25, 4);
    expect(settlement.outcome).toBe('WON');
  });

  it('returns less than the stake when a half loss drags the combo under 1', () => {
    const settlement = settleCombo(
      [
        { outcome: 'HALF_LOST', odds: 2 },
        { outcome: 'WON', odds: 1.5 },
      ],
      10,
    );
    expect(settlement.returnFactor).toBeCloseTo(0.75, 4);
    expect(settlement.outcome).toBe('HALF_LOST');
    expect(settlement.profit).toBe(-2.5);
  });

  it('treats an empty combo as a push', () => {
    expect(settleCombo([], 10).outcome).toBe('VOID');
  });
});
