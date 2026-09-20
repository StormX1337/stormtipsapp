import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@storm-tips/database';
import { closeApp, getApp } from './helpers.js';

interface Feed {
  totalTips: number;
  groups: { league: { name: string }; tips: { odds: number; marketType: string }[] }[];
}

/**
 * Searching and filtering the feed.
 *
 * The one that matters is the last: a locked tip is returned with its pick
 * stripped, and search must not hand it back a word at a time.
 */
describe('feed filters', () => {
  let app: FastifyInstance;
  let date: string;
  let leagueName: string;
  let teamName: string;
  let marketType: string;
  let odds: number;

  beforeAll(async () => {
    app = await getApp();
    const tip = await prisma.tip.findFirstOrThrow({
      where: { product: 'FREE', status: 'PUBLISHED', isStandalone: true },
      include: { league: true, event: { include: { homeTeam: true } } },
      orderBy: { publishAt: 'desc' },
    });
    date = tip.event.startsAt.toISOString().slice(0, 10);
    leagueName = tip.league.name;
    teamName = tip.event.homeTeam.name;
    marketType = tip.marketType;
    odds = Number(tip.odds);
  });

  afterAll(async () => {
    await closeApp();
  });

  async function feed(query: string): Promise<Feed> {
    const response = await app.inject({ method: 'GET', url: `/api/v1/tips/free?${query}` });
    expect(response.statusCode).toBe(200);
    return response.json() as Feed;
  }

  it('finds a tip by its league name', async () => {
    const result = await feed(`date=${date}&q=${encodeURIComponent(leagueName)}`);
    expect(result.totalTips).toBeGreaterThan(0);
    expect(result.groups.some((group) => group.league.name === leagueName)).toBe(true);
  });

  it('finds a tip by a team name', async () => {
    const result = await feed(`date=${date}&q=${encodeURIComponent(teamName)}`);
    expect(result.totalTips).toBeGreaterThan(0);
  });

  it('returns nothing rather than everything for a term that matches nothing', async () => {
    const result = await feed(`date=${date}&q=zzzznotateamanywhere`);
    expect(result.totalTips).toBe(0);
  });

  it('keeps the date filter when searching', async () => {
    // A search that clobbered the date clause would return the whole season.
    const result = await feed(`date=${date}&q=${encodeURIComponent(leagueName)}`);
    const other = await feed(`date=1999-01-01&q=${encodeURIComponent(leagueName)}`);
    expect(result.totalTips).toBeGreaterThan(0);
    expect(other.totalTips).toBe(0);
  });

  it('filters by market', async () => {
    const result = await feed(`date=${date}&marketType=${marketType}`);
    expect(result.totalTips).toBeGreaterThan(0);
    for (const group of result.groups) {
      for (const tip of group.tips) expect(tip.marketType).toBe(marketType);
    }
  });

  it('filters by an odds range', async () => {
    const result = await feed(`date=${date}&minOdds=${odds}`);
    for (const group of result.groups) {
      for (const tip of group.tips) expect(tip.odds).toBeGreaterThanOrEqual(odds);
    }
    const below = await feed(`date=${date}&maxOdds=1`);
    expect(below.totalTips).toBe(0);
  });

  it('refuses a one-character search instead of scanning for it', async () => {
    const response = await app.inject({ method: 'GET', url: `/api/v1/tips/free?date=${date}&q=a` });
    expect(response.statusCode).toBe(422);
  });

  it('never matches the selection of a tip the reader cannot see', async () => {
    // A locked tip is returned with its pick stripped. Search must not hand it
    // back a word at a time, so a word that appears only in the selection —
    // never in the team or league names, which are public anyway — must not
    // find it.
    const candidates = await prisma.tip.findMany({
      where: { product: 'VIP', status: 'PUBLISHED', isStandalone: true },
      include: { league: true, event: { include: { homeTeam: true, awayTeam: true } } },
      orderBy: { publishAt: 'desc' },
      take: 40,
    });

    const found = candidates
      .map((tip) => {
        const public_ = [
          tip.league.name,
          tip.event.homeTeam.name,
          tip.event.awayTeam.name,
          tip.event.homeTeam.shortName ?? '',
          tip.event.awayTeam.shortName ?? '',
        ]
          .join(' ')
          .toLowerCase();
        const word = tip.selectionLabel
          .split(/\s+/)
          .map((part) => part.replace(/[^a-z]/gi, ''))
          .find((part) => part.length > 3 && !public_.includes(part.toLowerCase()));
        return word ? { tip, word } : null;
      })
      .find((entry): entry is { tip: (typeof candidates)[number]; word: string } => entry !== null);

    expect(found, 'no locked tip with a selection-only word to probe with').toBeTruthy();

    const date_ = found!.tip.event.startsAt.toISOString().slice(0, 10);
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/tips/vip?date=${date_}&q=${encodeURIComponent(found!.word)}`,
    });
    const result = response.json() as Feed;
    expect(result.totalTips).toBe(0);
  });
});
