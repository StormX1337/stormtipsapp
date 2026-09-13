import { describe, expect, it } from 'vitest';
import {
  MockProvider,
  bestPrice,
  bookMargin,
  classifyMovement,
  createProvider,
  createProviderWithFallback,
  impliedProbability,
  isStale,
  relativeDelta,
} from '../src/index.js';

describe('MockProvider', () => {
  const provider = new MockProvider({ seed: 'test' });

  it('exposes the five supported sports', async () => {
    const sports = await provider.getSports();
    expect(sports.map((sport) => sport.key)).toEqual([
      'football',
      'tennis',
      'basketball',
      'ice-hockey',
      'baseball',
    ]);
  });

  it('returns leagues with a country and a sport', async () => {
    const leagues = await provider.getLeagues('football');
    expect(leagues.length).toBeGreaterThan(5);
    const epl = leagues.find((league) => league.key === 'england-premier-league');
    expect(epl?.name).toBe('Premier League');
    expect(epl?.countryCode).toBe('EN');
  });

  it('returns teams for a league without bundling logo assets', async () => {
    const teams = await provider.getTeams('germany-bundesliga');
    expect(teams.map((team) => team.name)).toContain('FC Bayern München');
    expect(teams.every((team) => team.logoUrl === null)).toBe(true);
  });

  it('generates deterministic fixtures for a date range', async () => {
    const from = new Date('2026-09-12T00:00:00Z');
    const to = new Date('2026-09-14T23:59:59Z');
    const first = await provider.getEvents({ from, to, sportKey: 'football' });
    const second = await new MockProvider({ seed: 'test' }).getEvents({
      from,
      to,
      sportKey: 'football',
    });
    expect(first.length).toBeGreaterThan(0);
    expect(first.map((event) => event.providerEventId)).toEqual(
      second.map((event) => event.providerEventId),
    );
    expect(first.every((event) => event.homeTeam.name !== event.awayTeam.name)).toBe(true);
  });

  it('keeps fixtures inside the requested range and sorted by kick-off', async () => {
    const from = new Date('2026-09-12T00:00:00Z');
    const to = new Date('2026-09-13T23:59:59Z');
    const events = await provider.getEvents({ from, to });
    for (const event of events) {
      expect(new Date(event.startsAt).getTime()).toBeGreaterThanOrEqual(from.getTime());
      expect(new Date(event.startsAt).getTime()).toBeLessThanOrEqual(to.getTime());
    }
    const times = events.map((event) => event.startsAt);
    expect([...times].sort()).toEqual(times);
  });

  it('produces a full odds book with a plausible margin', async () => {
    const events = await provider.getEvents({
      from: new Date('2026-09-12T00:00:00Z'),
      to: new Date('2026-09-12T23:59:59Z'),
      limit: 1,
    });
    const eventId = events[0]!.providerEventId;
    const odds = await provider.getOdds({ providerEventIds: [eventId] });
    expect(odds.length).toBeGreaterThan(10);

    const oneXTwo = odds.filter(
      (entry) => entry.marketType === 'MATCH_WINNER' && entry.bookmakerKey === 'betano',
    );
    expect(oneXTwo.map((entry) => entry.selection).sort()).toEqual(['AWAY', 'DRAW', 'HOME']);
    const margin = bookMargin(oneXTwo.map((entry) => entry.price));
    expect(margin).toBeGreaterThan(1);
    expect(margin).toBeLessThan(1.2);
  });

  it('only returns results for finished events, with a stable score', async () => {
    const events = await provider.getEvents({
      from: new Date(Date.now() - 5 * 86_400_000),
      to: new Date(Date.now() - 4 * 86_400_000),
    });
    const ids = events.slice(0, 5).map((event) => event.providerEventId);
    const results = await provider.getResults({ providerEventIds: ids });
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.status).toBe('FINISHED');
      expect(result.homeScore).toBeGreaterThanOrEqual(0);
      expect(result.htHomeScore ?? 0).toBeLessThanOrEqual(result.homeScore);
    }
    const again = await provider.getResults({ providerEventIds: ids });
    expect(again).toEqual(results);
  });

  it('reports healthy without any network access', async () => {
    const health = await provider.healthCheck();
    expect(health.ok).toBe(true);
    expect(provider.offline).toBe(true);
  });
});

describe('provider registry', () => {
  it('builds the mock provider without a key', () => {
    expect(createProvider({ slug: 'mock' }).slug).toBe('mock');
  });

  it('refuses a vendor provider without an API key', () => {
    expect(() => createProvider({ slug: 'sportsgameodds' })).toThrowError(/requires an API key/);
  });

  it('builds a vendor provider when a key is present', () => {
    expect(createProvider({ slug: 'theoddsapi', apiKey: 'key' }).slug).toBe('theoddsapi');
  });

  it('rejects an unknown slug', () => {
    expect(() => createProvider({ slug: 'nope' })).toThrowError(/Unknown sports provider/);
  });

  it('falls back to the mock provider and reports why', () => {
    const resolved = createProviderWithFallback({ slug: 'sportsgameodds' });
    expect(resolved.fellBack).toBe(true);
    expect(resolved.provider.slug).toBe('mock');
    expect(resolved.reason).toMatch(/API key/);
  });
});

describe('odds movement', () => {
  it('classifies movement against the opening price', () => {
    expect(classifyMovement(2, 2)).toBe('STABLE');
    expect(classifyMovement(2, 2.04)).toBe('UP');
    expect(classifyMovement(2, 2.2)).toBe('SIGNIFICANT_UP');
    expect(classifyMovement(2, 1.96)).toBe('DOWN');
    expect(classifyMovement(2, 1.8)).toBe('SIGNIFICANT_DOWN');
    expect(classifyMovement(0, 1.8)).toBe('STABLE');
  });

  it('computes the relative delta', () => {
    expect(relativeDelta(2, 2.2)).toBe(0.1);
    expect(relativeDelta(2, 1.8)).toBe(-0.1);
  });

  it('flags stale tipped odds', () => {
    expect(isStale(1.9, 1.75)).toBe(true);
    expect(isStale(1.9, 1.88)).toBe(false);
    expect(isStale(1.9, null)).toBe(false);
  });

  it('picks the best price', () => {
    expect(bestPrice([{ price: 1.8 }, { price: 2.1 }, { price: 1.95 }])).toEqual({ price: 2.1 });
    expect(bestPrice([])).toBeNull();
  });

  it('computes implied probability', () => {
    expect(impliedProbability(2)).toBe(0.5);
    expect(impliedProbability(1)).toBe(1);
  });
});
