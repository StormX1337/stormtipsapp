import { randomBytes } from 'node:crypto';
import { MarketType } from '@profit-tips/types';
import { settleSelection, type MatchResult, type SettlementOutcome } from '@profit-tips/statistics';

/** Monotonic, sortable, collision-safe id — lets us pre-assign ids for `createMany`. */
let counter = 0;
export function createId(prefix = 'c'): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36).padStart(4, '0')}${randomBytes(6).toString('hex')}`;
}

/** Deterministic PRNG so a re-seed produces the same demo dataset. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] as T;
}

export function between(random: () => number, min: number, max: number, decimals = 2): number {
  const value = min + random() * (max - min);
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export interface SelectionCandidate {
  marketKey: string;
  marketType: MarketType;
  selectionKey: string;
  line: number | null;
  label: (home: string, away: string) => string;
}

/** Candidate selections the seed can choose from, across the auto-settleable markets. */
export function candidateSelections(random: () => number): SelectionCandidate[] {
  const totalLine = pick([1.5, 2.5, 3.5, 2.25, 3.25, 2.75], random);
  const altLine = pick([3.75, 4.25, 2.75], random);
  const handicapLine = pick([-0.25, -0.5, -0.75, -1, -1.25, -1.5, 0.25, 0.5, 0.75, 1], random);

  return [
    {
      marketKey: '1x2',
      marketType: MarketType.MATCH_WINNER,
      selectionKey: 'HOME',
      line: null,
      label: (home) => `${home.toUpperCase()} WIN`,
    },
    {
      marketKey: '1x2',
      marketType: MarketType.MATCH_WINNER,
      selectionKey: 'AWAY',
      line: null,
      label: (_home, away) => `${away.toUpperCase()} WIN`,
    },
    {
      marketKey: 'double-chance',
      marketType: MarketType.DOUBLE_CHANCE,
      selectionKey: 'HOME_OR_DRAW',
      line: null,
      label: (home) => `${home.toUpperCase()} WIN OR DRAW`,
    },
    {
      marketKey: 'double-chance',
      marketType: MarketType.DOUBLE_CHANCE,
      selectionKey: 'AWAY_OR_DRAW',
      line: null,
      label: (_home, away) => `${away.toUpperCase()} WIN OR DRAW`,
    },
    {
      marketKey: 'totals',
      marketType: MarketType.OVER_UNDER,
      selectionKey: 'OVER',
      line: totalLine,
      label: () => `OVER ${totalLine.toFixed(1)} GOALS`,
    },
    {
      marketKey: 'totals',
      marketType: MarketType.OVER_UNDER,
      selectionKey: 'UNDER',
      line: totalLine,
      label: () => `UNDER ${totalLine.toFixed(1)} GOALS`,
    },
    {
      marketKey: 'alt-totals',
      marketType: MarketType.OVER_UNDER,
      selectionKey: 'UNDER',
      line: altLine,
      label: () => `ALTERNATIVE GOAL LINE UNDER ${splitLineLabel(altLine)}`,
    },
    {
      marketKey: 'btts',
      marketType: MarketType.BTTS,
      selectionKey: 'BTTS_YES',
      line: null,
      label: () => 'BOTH TEAMS TO SCORE',
    },
    {
      marketKey: 'btts',
      marketType: MarketType.BTTS,
      selectionKey: 'BTTS_NO',
      line: null,
      label: () => 'BOTH TEAMS TO SCORE - NO',
    },
    {
      marketKey: 'asian-handicap',
      marketType: MarketType.ASIAN_HANDICAP,
      selectionKey: 'HOME',
      line: handicapLine,
      label: (home) => `ASIAN HANDICAP ${splitLineLabel(handicapLine)} ${home.toUpperCase()}`,
    },
    {
      marketKey: 'asian-handicap',
      marketType: MarketType.ASIAN_HANDICAP,
      selectionKey: 'AWAY',
      line: handicapLine,
      label: (_home, away) => `ASIAN HANDICAP ${splitLineLabel(handicapLine)} ${away.toUpperCase()}`,
    },
    {
      marketKey: 'dnb',
      marketType: MarketType.DRAW_NO_BET,
      selectionKey: 'HOME',
      line: null,
      label: (home) => `${home.toUpperCase()} DRAW NO BET`,
    },
  ];
}

/**
 * Renders a quarter line the way operators display it — "-1.0, -1.5" — which is
 * exactly the notation used in the reference screenshots.
 */
export function splitLineLabel(line: number): string {
  const scaled = Math.round(Math.abs(line) * 100);
  if (scaled % 50 === 25) {
    const low = line - 0.25;
    const high = line + 0.25;
    return `${formatLine(Math.min(low, high))}, ${formatLine(Math.max(low, high))}`;
  }
  return formatLine(line);
}

function formatLine(line: number): string {
  return `${line > 0 ? '+' : ''}${line.toFixed(1)}`;
}

/**
 * Chooses a selection that settles to the desired outcome for a finished match.
 * Falls back to any auto-settleable selection when no candidate matches.
 */
export function selectionForOutcome(
  result: MatchResult,
  wantWin: boolean,
  random: () => number,
): { candidate: SelectionCandidate; outcome: SettlementOutcome } {
  const candidates = candidateSelections(random);
  const evaluated: { candidate: SelectionCandidate; outcome: SettlementOutcome }[] = [];

  for (const candidate of candidates) {
    try {
      const outcome = settleSelection(
        {
          marketType: candidate.marketType,
          selectionKey: candidate.selectionKey,
          line: candidate.line,
        },
        result,
      );
      evaluated.push({ candidate, outcome });
    } catch {
      // Market cannot be settled from this result — skip it.
    }
  }

  const winners = evaluated.filter(
    (entry) => entry.outcome === 'WON' || entry.outcome === 'HALF_WON',
  );
  const losers = evaluated.filter(
    (entry) => entry.outcome === 'LOST' || entry.outcome === 'HALF_LOST',
  );
  const pool = wantWin ? winners : losers;
  if (pool.length > 0) return pick(pool, random);
  return evaluated.length > 0 ? pick(evaluated, random) : { candidate: candidates[0]!, outcome: 'VOID' };
}

export function confidenceBandFor(confidence: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' {
  if (confidence >= 85) return 'VERY_HIGH';
  if (confidence >= 70) return 'HIGH';
  if (confidence >= 55) return 'MEDIUM';
  return 'LOW';
}

const ANALYSIS_OPENERS = [
  'Die Formkurve spricht klar für diese Auswahl',
  'Die erwarteten Tore (xG) der letzten fünf Spiele stützen die Auswahl',
  'Die Ausfallliste des Gegners verschiebt das Kräfteverhältnis',
  'Die Heimbilanz ist über die Saison konstant stark',
  'Der Spielplan spricht für eine Rotation beim Gegner',
  'Die direkten Duelle der letzten drei Jahre sind eindeutig',
];

const ANALYSIS_MIDDLES = [
  'Der Markt hat die Quote in den letzten 24 Stunden leicht gesenkt, was auf Zuspruch hindeutet.',
  'Die Quote liegt über unserem fairen Wert — daher sehen wir hier Value.',
  'Die Defensivwerte der Heimmannschaft sind im Saisonvergleich überdurchschnittlich.',
  'Beide Teams erzielen im Schnitt mehr als 1,4 Tore pro Spiel.',
  'Der Gegner hat unter der Woche international gespielt.',
];

const ANALYSIS_CLOSERS = [
  'Wichtig: Es handelt sich um eine Einschätzung, nicht um eine Garantie.',
  'Setze nur Beträge ein, deren Verlust du verkraften kannst.',
  'Die Auswahl ist für einen flachen Einsatz von einer Einheit kalkuliert.',
];

export function buildAnalysis(
  home: string,
  away: string,
  market: string,
  random: () => number,
): string {
  return [
    `${pick(ANALYSIS_OPENERS, random)} in der Partie ${home} – ${away}.`,
    pick(ANALYSIS_MIDDLES, random),
    `Unsere Auswahl: ${market}.`,
    pick(ANALYSIS_CLOSERS, random),
  ].join(' ');
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}
