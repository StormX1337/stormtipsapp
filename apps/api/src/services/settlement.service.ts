import { prisma, type Prisma } from '@storm-tips/database';
import {
  profitFor,
  returnFactor,
  settleCombo,
  settleSelection,
  type MatchResult,
  type SettlementOutcome,
} from '@storm-tips/statistics';
import { AppError, ErrorCode, type TipOutcome } from '@storm-tips/types';
import { logger } from '../lib/logger.js';
import { statistics } from './statistics.service.js';

export interface SettlementSummary {
  settled: number;
  skipped: number;
  failed: number;
  combosSettled: number;
}

/**
 * Result engine.
 *
 * Idempotency is enforced by the database: `tip_results.tipId` is unique, and
 * every settlement runs inside a transaction that re-reads the tip. A second
 * attempt therefore either finds the existing row or loses the unique-index
 * race — a result can never be counted twice.
 */
export class SettlementService {
  private toMatchResult(event: {
    homeScore: number | null;
    awayScore: number | null;
    htHomeScore: number | null;
    htAwayScore: number | null;
    homeCorners: number | null;
    awayCorners: number | null;
    homeYellowCards: number | null;
    awayYellowCards: number | null;
    homeRedCards: number | null;
    awayRedCards: number | null;
  }): MatchResult | null {
    if (event.homeScore === null || event.awayScore === null) return null;
    const cards = (yellow: number | null, red: number | null): number | null =>
      yellow === null && red === null ? null : (yellow ?? 0) + (red ?? 0);
    return {
      homeScore: event.homeScore,
      awayScore: event.awayScore,
      htHomeScore: event.htHomeScore,
      htAwayScore: event.htAwayScore,
      homeCorners: event.homeCorners,
      awayCorners: event.awayCorners,
      homeCards: cards(event.homeYellowCards, event.homeRedCards),
      awayCards: cards(event.awayYellowCards, event.awayRedCards),
    };
  }

  /**
   * Settles one tip. Returns `null` when the tip is already settled or cannot be
   * settled yet — both are normal, not errors.
   */
  async settleTip(tipId: string): Promise<SettlementOutcome | null> {
    const tip = await prisma.tip.findUnique({
      where: { id: tipId },
      include: { event: true, result: true },
    });
    if (!tip) throw AppError.notFound('Tip');
    if (tip.result) return null; // already settled — idempotent no-op
    if (tip.status === 'CANCELLED') return null;

    if (
      tip.event.status === 'CANCELLED' ||
      tip.event.status === 'ABANDONED' ||
      tip.event.status === 'POSTPONED'
    ) {
      const written = await this.writeResult(
        tip.id,
        'VOID',
        Number(tip.odds),
        Number(tip.stake),
        null,
        null,
        'ENGINE',
        'Event cancelled or postponed',
      );
      return written ? 'VOID' : null;
    }
    if (tip.event.status !== 'FINISHED') return null;

    const result = this.toMatchResult(tip.event);
    if (!result) return null;

    let outcome: SettlementOutcome;
    try {
      outcome = settleSelection(
        {
          marketType: tip.marketType,
          selectionKey: tip.selectionKey,
          line: tip.line === null ? null : Number(tip.line),
        },
        result,
      );
    } catch (error) {
      if (error instanceof AppError && error.code === ErrorCode.UNSUPPORTED_MARKET) {
        logger.info(
          { tipId: tip.id, market: tip.marketType },
          'tip requires manual settlement — left pending for an admin',
        );
        return null;
      }
      throw error;
    }

    const written = await this.writeResult(
      tip.id,
      outcome,
      Number(tip.odds),
      Number(tip.stake),
      result.homeScore,
      result.awayScore,
      'ENGINE',
    );
    return written ? outcome : null;
  }

  /**
   * Writes the settlement atomically.
   * Returns false when another worker won the race, so the caller does not
   * report a settlement (and therefore does not re-notify) for the same tip.
   */
  private async writeResult(
    tipId: string,
    outcome: SettlementOutcome,
    odds: number,
    stake: number,
    homeScore: number | null,
    awayScore: number | null,
    settledBy: string,
    note?: string,
  ): Promise<boolean> {
    const settledAt = new Date();
    try {
      await prisma.$transaction([
        prisma.tipResult.create({
          data: {
            tipId,
            outcome: outcome as TipOutcome,
            returnFactor: returnFactor(outcome, odds),
            stake,
            profit: profitFor(outcome, odds, stake),
            homeScore,
            awayScore,
            settledBy,
            note: note ?? null,
            settledAt,
          },
        }),
        prisma.tip.update({
          where: { id: tipId },
          data: { outcome: outcome as TipOutcome, settledAt },
        }),
      ]);
      return true;
    } catch (error) {
      // Unique violation on tipId means another worker settled it first.
      if ((error as { code?: string }).code === 'P2002') {
        logger.debug({ tipId }, 'settlement raced — result already written');
        return false;
      }
      throw error;
    }
  }

  /** Admin override — records who settled the tip and why. */
  async settleManually(
    tipId: string,
    outcome: TipOutcome,
    actorId: string,
    input: { homeScore?: number | null; awayScore?: number | null; note?: string | null } = {},
  ): Promise<void> {
    const tip = await prisma.tip.findUnique({ where: { id: tipId }, include: { result: true } });
    if (!tip) throw AppError.notFound('Tip');
    if (tip.result) {
      throw new AppError(ErrorCode.ALREADY_SETTLED, 'This tip has already been settled');
    }
    if (outcome === 'PENDING' || outcome === 'LIVE') {
      throw AppError.validation('A manual settlement must be a final outcome');
    }
    const written = await this.writeResult(
      tipId,
      outcome as SettlementOutcome,
      Number(tip.odds),
      Number(tip.stake),
      input.homeScore ?? null,
      input.awayScore ?? null,
      `ADMIN:${actorId}`,
      input.note ?? undefined,
    );
    if (!written) {
      throw new AppError(ErrorCode.ALREADY_SETTLED, 'This tip has already been settled');
    }
  }

  /** Re-opens a settlement (for example after a provider correction). */
  async resettle(tipId: string, actorId: string): Promise<void> {
    await prisma.$transaction([
      prisma.tipResult.deleteMany({ where: { tipId } }),
      prisma.tip.update({
        where: { id: tipId },
        data: { outcome: 'PENDING', settledAt: null },
      }),
    ]);
    logger.warn({ tipId, actorId }, 'tip settlement reverted');
  }

  /** Settles a combo once every leg has a result. */
  async settleCombo(comboId: string): Promise<SettlementOutcome | null> {
    const combo = await prisma.combo.findUnique({
      where: { id: comboId },
      include: { items: { include: { tip: { include: { result: true } } } } },
    });
    if (!combo || combo.settledAt) return null;
    if (combo.items.length === 0) return null;
    if (combo.items.some((item) => !item.tip.result)) return null;

    const settlement = settleCombo(
      combo.items.map((item) => ({
        outcome: item.tip.result!.outcome as SettlementOutcome,
        odds: Number(item.tip.odds),
      })),
      Number(combo.stake),
    );

    await prisma.combo.update({
      where: { id: comboId },
      data: {
        outcome: settlement.outcome as TipOutcome,
        returnFactor: settlement.returnFactor,
        profit: settlement.profit,
        settledAt: new Date(),
      },
    });
    return settlement.outcome;
  }

  /**
   * Settles every finished fixture that still has pending tips.
   * Safe to run concurrently and repeatedly.
   */
  async settleDueTips(limit = 500): Promise<SettlementSummary> {
    const summary: SettlementSummary = { settled: 0, skipped: 0, failed: 0, combosSettled: 0 };

    const pending = await prisma.tip.findMany({
      where: {
        outcome: { in: ['PENDING', 'LIVE'] },
        status: { in: ['PUBLISHED', 'SCHEDULED'] },
        event: { status: { in: ['FINISHED', 'CANCELLED', 'ABANDONED', 'POSTPONED'] } },
      },
      select: { id: true },
      take: limit,
    });

    for (const tip of pending) {
      try {
        const outcome = await this.settleTip(tip.id);
        if (outcome) summary.settled += 1;
        else summary.skipped += 1;
      } catch (error) {
        summary.failed += 1;
        logger.error({ err: error, tipId: tip.id }, 'failed to settle tip');
      }
    }

    const openCombos = await prisma.combo.findMany({
      where: { settledAt: null, outcome: 'PENDING' },
      select: { id: true },
      take: limit,
    });
    for (const combo of openCombos) {
      try {
        if (await this.settleCombo(combo.id)) summary.combosSettled += 1;
      } catch (error) {
        logger.error({ err: error, comboId: combo.id }, 'failed to settle combo');
      }
    }

    if (summary.settled > 0 || summary.combosSettled > 0) {
      await statistics.invalidate();
    }
    return summary;
  }

  /** Tips waiting on a human because their market cannot be settled automatically. */
  async manualQueue(): Promise<Prisma.TipGetPayload<{ include: { event: true } }>[]> {
    return prisma.tip.findMany({
      where: {
        outcome: { in: ['PENDING', 'LIVE'] },
        marketType: { in: ['PLAYER_PROP', 'OTHER'] },
        event: { status: 'FINISHED' },
      },
      include: { event: true },
      orderBy: { settledAt: 'asc' },
      take: 100,
    });
  }
}

export const settlement = new SettlementService();
