import type { Prisma } from '@storm-tips/database';
import { DEFAULT_LOCALE, localizer } from '@storm-tips/types';
import type { ComboDTO, ProductCode, TipDTO, TipResultDTO } from '@storm-tips/types';
import { dec, decOr, iso } from './common.js';
import {
  eventInclude,
  leagueInclude,
  serializeBookmaker,
  serializeEvent,
  serializeLeague,
  serializeCountry,
  serializeSport,
} from './catalogue.js';

export const tipInclude = {
  sport: true,
  country: true,
  league: { include: leagueInclude },
  event: { include: eventInclude },
  market: true,
  bookmaker: true,
  result: true,
} satisfies Prisma.TipInclude;

export type TipWithRelations = Prisma.TipGetPayload<{ include: typeof tipInclude }>;

export const comboInclude = {
  items: { include: { tip: { include: tipInclude } }, orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.ComboInclude;

export type ComboWithRelations = Prisma.ComboGetPayload<{ include: typeof comboInclude }>;

function serializeResult(result: TipWithRelations['result']): TipResultDTO | null {
  if (!result) return null;
  return {
    outcome: result.outcome,
    returnFactor: decOr(result.returnFactor, 0),
    stake: decOr(result.stake, 0),
    profit: decOr(result.profit, 0),
    homeScore: result.homeScore,
    awayScore: result.awayScore,
    settledAt: result.settledAt.toISOString(),
    note: result.note,
  };
}

/**
 * Converts a tip to its API shape.
 *
 * When the viewer lacks the entitlement the premium fields (selection, odds,
 * analysis, confidence) are stripped **on the server** — a locked tip never
 * leaves the process with its pick inside it.
 */
export function serializeTip(
  tip: TipWithRelations,
  unlocked: boolean,
  locale: string = DEFAULT_LOCALE,
): TipDTO {
  const locked = !unlocked;
  const text = localizer(tip, locale);
  return {
    id: tip.id,
    product: tip.product as ProductCode,
    status: tip.status,
    outcome: tip.outcome,
    isLive: tip.isLive,
    isLocked: locked,

    sport: serializeSport(tip.sport),
    country: serializeCountry(tip.country),
    league: serializeLeague(tip.league),
    event: serializeEvent(tip.event),
    bookmaker: serializeBookmaker(tip.bookmaker),

    marketType: tip.marketType,
    marketName: localizer(tip.market, locale).text('name', tip.market.name),
    selectionLabel: locked ? null : tip.selectionLabel,
    selectionKey: locked ? null : tip.selectionKey,
    line: locked ? null : dec(tip.line),

    odds: locked ? null : dec(tip.odds),
    originalOdds: locked ? null : dec(tip.originalOdds),
    currentOdds: locked ? null : dec(tip.currentOdds),
    oddsChanged: locked ? false : tip.oddsChanged,
    stake: decOr(tip.stake, 10),

    confidence: locked ? null : tip.confidence,
    confidenceBand: locked ? null : tip.confidenceBand,

    title: text.text('title', tip.title),
    analysis: locked ? null : text.text('analysis', tip.analysis),
    imageUrl: tip.imageUrl,
    tags: tip.tags,

    publishAt: iso(tip.publishAt),
    expiresAt: iso(tip.expiresAt),
    settledAt: iso(tip.settledAt),
    createdAt: tip.createdAt.toISOString(),

    result: locked ? null : serializeResult(tip.result),
  };
}

export function serializeCombo(
  combo: ComboWithRelations,
  unlocked: boolean,
  locale: string = DEFAULT_LOCALE,
): ComboDTO {
  const totalOdds = dec(combo.totalOdds);
  const stake = decOr(combo.stake, 10);
  const text = localizer(combo, locale);
  return {
    id: combo.id,
    title: text.text('title', combo.title),
    subtitle: text.text('subtitle', combo.subtitle),
    product: combo.product as ProductCode,
    status: combo.status,
    outcome: combo.outcome,
    isLocked: !unlocked,
    totalOdds: unlocked ? totalOdds : null,
    stake,
    potentialReturn: unlocked && totalOdds ? Math.round(totalOdds * stake * 100) / 100 : null,
    profit: unlocked ? dec(combo.profit) : null,
    analysis: unlocked ? text.text('analysis', combo.analysis) : null,
    publishAt: iso(combo.publishAt),
    settledAt: iso(combo.settledAt),
    items: combo.items.map((item) => serializeTip(item.tip, unlocked, locale)),
  };
}
