import { MarketType, type EventStatus } from '@profit-tips/types';
import { BaseProvider } from '../provider.js';
import {
  CATALOGUE_BOOKMAKERS,
  CATALOGUE_LEAGUES,
  CATALOGUE_SPORTS,
  type CatalogueLeague,
} from './catalogue.js';
import type {
  EventQuery,
  OddsQuery,
  ProviderConfig,
  ProviderEvent,
  ProviderLeague,
  ProviderOdds,
  ProviderResult,
  ProviderSport,
  ProviderTeam,
  ResultQuery,
} from '../types.js';

/** Deterministic 32-bit PRNG (mulberry32) so every run produces the same fixtures. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const DAY_MS = 86_400_000;

/**
 * Default generator seed.
 *
 * Every consumer (database seed, API, worker) must use the same salt, otherwise
 * the same `providerEventId` would resolve to different fixtures and a later
 * sync would silently rewrite the teams of an already-stored event.
 */
export const DEFAULT_MOCK_SEED = process.env.MOCK_PROVIDER_SEED ?? 'profit-tips';

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dayKey(date: Date): string {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

/**
 * Offline sports provider.
 *
 * Generates a complete, self-consistent fixture/odds/result feed from a seed, so
 * the entire platform — seeds, tests, CI and local development — runs with no
 * vendor credentials. Every fixture derives from `(leagueKey, dayKey, index)`,
 * which makes the data stable across processes and restarts.
 */
export class MockProvider extends BaseProvider {
  readonly slug = 'mock';
  readonly name = 'Mock provider (offline)';
  override readonly offline = true;

  private readonly enabledSports: string[];
  private readonly enabledLeagueKeys: string[];
  private readonly seedSalt: number;

  constructor(config: Partial<ProviderConfig> & { seed?: string } = {}) {
    super();
    this.enabledSports = config.enabledSports ?? [];
    this.enabledLeagueKeys = config.enabledLeagueKeys ?? [];
    this.seedSalt = hashString(config.seed ?? DEFAULT_MOCK_SEED);
  }

  private leagues(): CatalogueLeague[] {
    return CATALOGUE_LEAGUES.filter((league) => {
      if (this.enabledSports.length > 0 && !this.enabledSports.includes(league.sportKey)) {
        return false;
      }
      if (this.enabledLeagueKeys.length > 0 && !this.enabledLeagueKeys.includes(league.key)) {
        return false;
      }
      return true;
    });
  }

  async getSports(): Promise<ProviderSport[]> {
    return CATALOGUE_SPORTS.filter(
      (sport) => this.enabledSports.length === 0 || this.enabledSports.includes(sport.key),
    ).map((sport) => ({ key: sport.key, name: sport.name, icon: sport.icon }));
  }

  async getLeagues(sportKey?: string): Promise<ProviderLeague[]> {
    return this.leagues()
      .filter((league) => !sportKey || league.sportKey === sportKey)
      .map((league) => ({
        providerLeagueId: `mock-${league.key}`,
        key: league.key,
        name: league.name,
        shortName: league.shortName,
        sportKey: league.sportKey,
        countryCode: league.countryCode,
        logoUrl: null,
        season: '2026/27',
        tier: league.tier,
      }));
  }

  async getTeams(leagueKey: string): Promise<ProviderTeam[]> {
    const league = this.leagues().find((entry) => entry.key === leagueKey);
    if (!league) return [];
    return league.teams.map((entry) => this.toProviderTeam(league, entry.name));
  }

  private toProviderTeam(league: CatalogueLeague, name: string): ProviderTeam {
    const entry = league.teams.find((team) => team.name === name) ?? league.teams[0]!;
    return {
      providerTeamId: `mock-${slugify(entry.name)}`,
      name: entry.name,
      shortName: entry.shortName,
      code: entry.code,
      sportKey: league.sportKey,
      countryCode: league.countryCode,
      logoUrl: null,
      colorPrimary: entry.color,
    };
  }

  /**
   * Builds the fixture list for one league on one day.
   * Deterministic: the same league+day always yields the same pairings.
   */
  private eventsForLeagueDay(league: CatalogueLeague, day: Date): ProviderEvent[] {
    const key = `${league.key}:${dayKey(day)}`;
    const random = mulberry32(hashString(key) ^ this.seedSalt);
    const maxFixtures = Math.min(4, Math.floor(league.teams.length / 2));
    const count = 1 + Math.floor(random() * maxFixtures);

    const pool = [...league.teams];
    // Fisher-Yates with the seeded PRNG.
    for (let index = pool.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [pool[index], pool[swap]] = [pool[swap]!, pool[index]!];
    }

    const events: ProviderEvent[] = [];
    const now = Date.now();

    for (let index = 0; index < count && pool.length >= 2; index += 1) {
      const home = pool.shift()!;
      const away = pool.shift()!;
      const kickoffHour = 13 + Math.floor(random() * 8); // 13:00 – 20:00 UTC
      const kickoffMinute = random() < 0.5 ? 0 : 30;
      const startsAt = new Date(startOfUtcDay(day).getTime());
      startsAt.setUTCHours(kickoffHour, kickoffMinute, 0, 0);

      const providerEventId = `mock-${league.key}-${dayKey(day)}-${index}`;
      const elapsedMs = now - startsAt.getTime();
      let status: EventStatus = 'SCHEDULED';
      let minute: number | null = null;
      if (elapsedMs > 115 * 60_000) status = 'FINISHED';
      else if (elapsedMs > 60 * 60_000) {
        status = 'LIVE';
        minute = Math.min(90, 45 + Math.floor((elapsedMs - 60 * 60_000) / 60_000));
      } else if (elapsedMs > 45 * 60_000) status = 'HALFTIME';
      else if (elapsedMs > 0) {
        status = 'LIVE';
        minute = Math.max(1, Math.floor(elapsedMs / 60_000));
      }

      const score = this.scoreFor(providerEventId, league.sportKey);
      const played = status === 'FINISHED';
      const inPlay = status === 'LIVE' || status === 'HALFTIME';
      const progress = inPlay ? Math.min(1, Math.max(0.15, (minute ?? 45) / 90)) : 0;

      events.push({
        providerEventId,
        sportKey: league.sportKey,
        leagueKey: league.key,
        countryCode: league.countryCode,
        startsAt: startsAt.toISOString(),
        status,
        homeTeam: this.toProviderTeam(league, home.name),
        awayTeam: this.toProviderTeam(league, away.name),
        homeScore: played ? score.home : inPlay ? Math.round(score.home * progress) : null,
        awayScore: played ? score.away : inPlay ? Math.round(score.away * progress) : null,
        htHomeScore: played ? score.htHome : null,
        htAwayScore: played ? score.htAway : null,
        minute,
        period: status === 'HALFTIME' ? 'HT' : status === 'LIVE' ? '2H' : null,
        homeRedCards: played ? score.homeRed : null,
        awayRedCards: played ? score.awayRed : null,
        homeYellowCards: played ? score.homeYellow : null,
        awayYellowCards: played ? score.awayYellow : null,
        homeCorners: played ? score.homeCorners : null,
        awayCorners: played ? score.awayCorners : null,
        venue: `${home.shortName} Arena`,
        round: `Matchday ${1 + (Math.abs(hashString(dayKey(day))) % 34)}`,
        season: '2026/27',
        statistics: null,
      });
    }

    return events;
  }

  /** Deterministic score for an event id — the same fixture always ends the same way. */
  private scoreFor(providerEventId: string, sportKey: string) {
    const random = mulberry32(hashString(`score:${providerEventId}`) ^ this.seedSalt);
    const scale = sportKey === 'basketball' ? 100 : sportKey === 'baseball' ? 6 : 3;
    const home = Math.floor(random() * scale * (sportKey === 'basketball' ? 1.2 : 1.1));
    const away = Math.floor(random() * scale);
    return {
      home,
      away,
      htHome: Math.floor(home * random()),
      htAway: Math.floor(away * random()),
      homeRed: random() < 0.08 ? 1 : 0,
      awayRed: random() < 0.08 ? 1 : 0,
      homeYellow: Math.floor(random() * 4),
      awayYellow: Math.floor(random() * 4),
      homeCorners: 2 + Math.floor(random() * 9),
      awayCorners: 2 + Math.floor(random() * 9),
    };
  }

  async getEvents(query: EventQuery = {}): Promise<ProviderEvent[]> {
    const from = query.from ?? new Date(Date.now() - 2 * DAY_MS);
    const to = query.to ?? new Date(Date.now() + 5 * DAY_MS);
    const leagues = this.leagues().filter((league) => {
      if (query.sportKey && league.sportKey !== query.sportKey) return false;
      if (query.leagueKeys?.length && !query.leagueKeys.includes(league.key)) return false;
      return true;
    });

    const events: ProviderEvent[] = [];
    for (
      let day = startOfUtcDay(from);
      day.getTime() <= to.getTime();
      day = new Date(day.getTime() + DAY_MS)
    ) {
      for (const league of leagues) {
        events.push(...this.eventsForLeagueDay(league, day));
      }
    }

    let filtered = events.filter(
      (event) =>
        new Date(event.startsAt).getTime() >= from.getTime() &&
        new Date(event.startsAt).getTime() <= to.getTime(),
    );
    if (query.live) {
      filtered = filtered.filter((event) => event.status === 'LIVE' || event.status === 'HALFTIME');
    }
    filtered.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return query.limit ? filtered.slice(0, query.limit) : filtered;
  }

  async getOdds(query: OddsQuery): Promise<ProviderOdds[]> {
    const odds: ProviderOdds[] = [];
    const bookmakers = query.bookmakerKeys?.length
      ? CATALOGUE_BOOKMAKERS.filter((book) => query.bookmakerKeys?.includes(book.key))
      : CATALOGUE_BOOKMAKERS.slice(0, 4);

    for (const providerEventId of query.providerEventIds) {
      const base = mulberry32(hashString(`odds:${providerEventId}`) ^ this.seedSalt);
      // Fair probabilities for 1X2, then a per-bookmaker margin.
      const pHome = 0.25 + base() * 0.35;
      const pDraw = 0.18 + base() * 0.14;
      const pAway = Math.max(0.08, 1 - pHome - pDraw);
      const totalLine = 2.5;
      const pOver = 0.4 + base() * 0.25;

      for (const bookmaker of bookmakers) {
        const margin =
          1.03 + mulberry32(hashString(`${providerEventId}:${bookmaker.key}`))() * 0.05;
        const now = new Date().toISOString();
        const price = (probability: number) =>
          Math.round(Math.max(1.01, 1 / (probability * margin)) * 100) / 100;

        const push = (
          marketType: MarketType,
          marketKey: string,
          selection: string,
          line: number,
          value: number,
        ): void => {
          odds.push({
            providerEventId,
            bookmakerKey: bookmaker.key,
            bookmakerName: bookmaker.name,
            marketType,
            marketKey,
            selection,
            line,
            price: value,
            isSuspended: false,
            lastUpdate: now,
          });
        };

        push(MarketType.MATCH_WINNER, '1x2', 'HOME', 0, price(pHome));
        push(MarketType.MATCH_WINNER, '1x2', 'DRAW', 0, price(pDraw));
        push(MarketType.MATCH_WINNER, '1x2', 'AWAY', 0, price(pAway));
        push(MarketType.DOUBLE_CHANCE, 'double-chance', 'HOME_OR_DRAW', 0, price(pHome + pDraw));
        push(MarketType.DOUBLE_CHANCE, 'double-chance', 'AWAY_OR_DRAW', 0, price(pAway + pDraw));
        push(MarketType.DOUBLE_CHANCE, 'double-chance', 'HOME_OR_AWAY', 0, price(pHome + pAway));
        push(MarketType.OVER_UNDER, 'totals', 'OVER', totalLine, price(pOver));
        push(MarketType.OVER_UNDER, 'totals', 'UNDER', totalLine, price(1 - pOver));
        push(MarketType.BTTS, 'btts', 'BTTS_YES', 0, price(0.48 + base() * 0.1));
        push(MarketType.BTTS, 'btts', 'BTTS_NO', 0, price(0.42 + base() * 0.1));
        push(MarketType.ASIAN_HANDICAP, 'asian-handicap', 'HOME', -0.25, price(pHome + 0.08));
        push(MarketType.ASIAN_HANDICAP, 'asian-handicap', 'AWAY', 0.25, price(pAway + 0.08));
      }
    }

    if (query.marketTypes?.length) {
      return odds.filter((entry) => query.marketTypes?.includes(entry.marketType));
    }
    return odds;
  }

  async getResults(query: ResultQuery): Promise<ProviderResult[]> {
    const results: ProviderResult[] = [];
    for (const providerEventId of query.providerEventIds) {
      const parsed = parseMockEventId(providerEventId);
      if (!parsed) continue;
      const league = CATALOGUE_LEAGUES.find((entry) => entry.key === parsed.leagueKey);
      if (!league) continue;
      const events = this.eventsForLeagueDay(league, new Date(`${parsed.day}T00:00:00.000Z`));
      const event = events.find((entry) => entry.providerEventId === providerEventId);
      if (!event || event.status !== 'FINISHED') continue;
      const score = this.scoreFor(providerEventId, league.sportKey);
      results.push({
        providerEventId,
        status: 'FINISHED',
        homeScore: score.home,
        awayScore: score.away,
        htHomeScore: score.htHome,
        htAwayScore: score.htAway,
        homeCorners: score.homeCorners,
        awayCorners: score.awayCorners,
        homeCards: score.homeYellow + score.homeRed,
        awayCards: score.awayYellow + score.awayRed,
        finishedAt: new Date(new Date(event.startsAt).getTime() + 115 * 60_000).toISOString(),
      });
    }
    return results;
  }
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** `mock-<leagueKey>-<YYYY-MM-DD>-<index>` */
function parseMockEventId(id: string): { leagueKey: string; day: string; index: number } | null {
  const match = /^mock-(.+)-(\d{4}-\d{2}-\d{2})-(\d+)$/.exec(id);
  if (!match) return null;
  return { leagueKey: match[1]!, day: match[2]!, index: Number(match[3]) };
}
