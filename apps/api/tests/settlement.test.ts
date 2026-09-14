import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@storm-tips/database';
import { settlement } from '../src/services/settlement.service.js';
import { billing } from '../src/services/billing.service.js';
import { closeApp } from './helpers.js';

const cleanup: { tips: string[]; events: string[]; combos: string[]; webhooks: string[] } = {
  tips: [],
  events: [],
  combos: [],
  webhooks: [],
};

let leagueId: string;
let sportId: string;
let marketId: string;
let homeTeamId: string;
let awayTeamId: string;

beforeAll(async () => {
  const league = await prisma.league.findFirstOrThrow({ include: { sport: true } });
  leagueId = league.id;
  sportId = league.sportId;
  marketId = (await prisma.market.findFirstOrThrow({ where: { key: '1x2' } })).id;
  const teams = await prisma.team.findMany({ where: { sportId }, take: 2 });
  homeTeamId = teams[0]!.id;
  awayTeamId = teams[1]!.id;
});

afterAll(async () => {
  await prisma.comboItem.deleteMany({ where: { comboId: { in: cleanup.combos } } });
  await prisma.combo.deleteMany({ where: { id: { in: cleanup.combos } } });
  await prisma.tipResult.deleteMany({ where: { tipId: { in: cleanup.tips } } });
  await prisma.tip.deleteMany({ where: { id: { in: cleanup.tips } } });
  await prisma.event.deleteMany({ where: { id: { in: cleanup.events } } });
  await prisma.webhookEvent.deleteMany({ where: { eventId: { in: cleanup.webhooks } } });
  await closeApp();
});

async function createFinishedEvent(homeScore: number, awayScore: number): Promise<string> {
  const event = await prisma.event.create({
    data: {
      sportId,
      leagueId,
      homeTeamId,
      awayTeamId,
      startsAt: new Date(Date.now() - 3 * 3_600_000),
      status: 'FINISHED',
      homeScore,
      awayScore,
      htHomeScore: 0,
      htAwayScore: 0,
      providerSlug: `test-${crypto.randomUUID()}`,
    },
  });
  cleanup.events.push(event.id);
  return event.id;
}

async function createTip(eventId: string, selectionKey: string, odds = 2): Promise<string> {
  const tip = await prisma.tip.create({
    data: {
      sportId,
      leagueId,
      eventId,
      marketId,
      marketType: 'MATCH_WINNER',
      selectionLabel: `${selectionKey} WIN`,
      selectionKey,
      odds,
      originalOdds: odds,
      stake: 10,
      product: 'FREE',
      status: 'PUBLISHED',
      publishAt: new Date(Date.now() - 4 * 3_600_000),
    },
  });
  cleanup.tips.push(tip.id);
  return tip.id;
}

describe('result engine', () => {
  it('settles a winning tip and records the profit', async () => {
    const eventId = await createFinishedEvent(2, 0);
    const tipId = await createTip(eventId, 'HOME', 1.8);

    const outcome = await settlement.settleTip(tipId);
    expect(outcome).toBe('WON');

    const result = await prisma.tipResult.findUniqueOrThrow({ where: { tipId } });
    expect(Number(result.returnFactor)).toBe(1.8);
    expect(Number(result.profit)).toBe(8);
    expect(result.homeScore).toBe(2);

    const tip = await prisma.tip.findUniqueOrThrow({ where: { id: tipId } });
    expect(tip.outcome).toBe('WON');
    expect(tip.settledAt).not.toBeNull();
  });

  it('settles a losing tip', async () => {
    const eventId = await createFinishedEvent(0, 2);
    const tipId = await createTip(eventId, 'HOME', 1.8);
    expect(await settlement.settleTip(tipId)).toBe('LOST');
    const result = await prisma.tipResult.findUniqueOrThrow({ where: { tipId } });
    expect(Number(result.profit)).toBe(-10);
  });

  it('is idempotent — a second settlement is a no-op', async () => {
    const eventId = await createFinishedEvent(3, 1);
    const tipId = await createTip(eventId, 'HOME');

    expect(await settlement.settleTip(tipId)).toBe('WON');
    expect(await settlement.settleTip(tipId)).toBeNull();
    expect(await settlement.settleTip(tipId)).toBeNull();

    const results = await prisma.tipResult.count({ where: { tipId } });
    expect(results).toBe(1);
  });

  it('never double-counts under concurrent settlement', async () => {
    const eventId = await createFinishedEvent(1, 0);
    const tipId = await createTip(eventId, 'HOME');

    const outcomes = await Promise.all([
      settlement.settleTip(tipId),
      settlement.settleTip(tipId),
      settlement.settleTip(tipId),
    ]);

    expect(outcomes.filter(Boolean)).toHaveLength(1);
    expect(await prisma.tipResult.count({ where: { tipId } })).toBe(1);
  });

  it('voids a tip whose fixture was cancelled', async () => {
    const eventId = await createFinishedEvent(0, 0);
    await prisma.event.update({ where: { id: eventId }, data: { status: 'CANCELLED' } });
    const tipId = await createTip(eventId, 'HOME');

    expect(await settlement.settleTip(tipId)).toBe('VOID');
    const result = await prisma.tipResult.findUniqueOrThrow({ where: { tipId } });
    expect(Number(result.returnFactor)).toBe(1);
    expect(Number(result.profit)).toBe(0);
  });

  it('leaves a tip pending while the fixture is unfinished', async () => {
    const eventId = await createFinishedEvent(0, 0);
    await prisma.event.update({ where: { id: eventId }, data: { status: 'SCHEDULED' } });
    const tipId = await createTip(eventId, 'HOME');
    expect(await settlement.settleTip(tipId)).toBeNull();
    expect(await prisma.tipResult.count({ where: { tipId } })).toBe(0);
  });

  it('leaves a manual-only market for a human', async () => {
    const eventId = await createFinishedEvent(2, 1);
    const tipId = await createTip(eventId, 'ANYTIME_SCORER');
    await prisma.tip.update({ where: { id: tipId }, data: { marketType: 'PLAYER_PROP' } });
    expect(await settlement.settleTip(tipId)).toBeNull();
  });

  it('settles a combo once every leg has a result', async () => {
    const eventA = await createFinishedEvent(2, 0);
    const eventB = await createFinishedEvent(3, 1);
    const tipA = await createTip(eventA, 'HOME', 1.5);
    const tipB = await createTip(eventB, 'HOME', 1.8);

    const combo = await prisma.combo.create({
      data: {
        title: 'Test combo',
        totalOdds: 2.7,
        stake: 10,
        status: 'PUBLISHED',
        items: {
          create: [
            { tipId: tipA, sortOrder: 0 },
            { tipId: tipB, sortOrder: 1 },
          ],
        },
      },
    });
    cleanup.combos.push(combo.id);

    // Not settleable while a leg is still open.
    expect(await settlement.settleCombo(combo.id)).toBeNull();

    await settlement.settleTip(tipA);
    await settlement.settleTip(tipB);

    expect(await settlement.settleCombo(combo.id)).toBe('WON');
    const settled = await prisma.combo.findUniqueOrThrow({ where: { id: combo.id } });
    expect(Number(settled.returnFactor)).toBeCloseTo(2.7, 2);
    expect(Number(settled.profit)).toBeCloseTo(17, 1);

    // Re-settling changes nothing.
    expect(await settlement.settleCombo(combo.id)).toBeNull();
  });

  it('loses a combo as soon as one leg loses', async () => {
    const eventA = await createFinishedEvent(2, 0);
    const eventB = await createFinishedEvent(0, 2);
    const tipA = await createTip(eventA, 'HOME', 1.5);
    const tipB = await createTip(eventB, 'HOME', 1.8);

    const combo = await prisma.combo.create({
      data: {
        title: 'Losing combo',
        totalOdds: 2.7,
        stake: 10,
        status: 'PUBLISHED',
        items: {
          create: [
            { tipId: tipA, sortOrder: 0 },
            { tipId: tipB, sortOrder: 1 },
          ],
        },
      },
    });
    cleanup.combos.push(combo.id);

    await settlement.settleTip(tipA);
    await settlement.settleTip(tipB);
    expect(await settlement.settleCombo(combo.id)).toBe('LOST');
    const settled = await prisma.combo.findUniqueOrThrow({ where: { id: combo.id } });
    expect(Number(settled.profit)).toBe(-10);
  });
});

describe('webhook idempotency', () => {
  it('claims an event once and rejects the retry', async () => {
    const eventId = `evt_test_${crypto.randomUUID()}`;
    cleanup.webhooks.push(eventId);

    expect(await billing.claimWebhook('STRIPE', eventId, 'invoice.paid', { a: 1 })).toBe(true);
    expect(await billing.claimWebhook('STRIPE', eventId, 'invoice.paid', { a: 1 })).toBe(false);

    await billing.completeWebhook('STRIPE', eventId, 'PROCESSED');
    expect(await billing.claimWebhook('STRIPE', eventId, 'invoice.paid', { a: 1 })).toBe(false);

    const rows = await prisma.webhookEvent.count({ where: { provider: 'STRIPE', eventId } });
    expect(rows).toBe(1);
  });

  it('allows a failed event to be retried', async () => {
    const eventId = `evt_fail_${crypto.randomUUID()}`;
    cleanup.webhooks.push(eventId);

    expect(await billing.claimWebhook('STRIPE', eventId, 'invoice.paid', {})).toBe(true);
    await billing.completeWebhook('STRIPE', eventId, 'FAILED', 'boom');

    expect(await billing.claimWebhook('STRIPE', eventId, 'invoice.paid', {})).toBe(true);
    const row = await prisma.webhookEvent.findFirstOrThrow({
      where: { provider: 'STRIPE', eventId },
    });
    expect(row.attempts).toBe(2);
  });

  it('separates the same event id across providers', async () => {
    const eventId = `shared_${crypto.randomUUID()}`;
    cleanup.webhooks.push(eventId);
    expect(await billing.claimWebhook('STRIPE', eventId, 'x', {})).toBe(true);
    expect(await billing.claimWebhook('APPLE', eventId, 'x', {})).toBe(true);
  });
});
