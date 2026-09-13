import { MarketType, type EventStatus } from '@profit-tips/types';
import { BaseProvider } from '../provider.js';
import { HttpClient } from '../http.js';
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

/**
 * SportsGameOdds adapter (https://sportsgameodds.com — REST v2, `X-Api-Key` header).
 *
 * The vendor returns one rich `event` object that carries fixture, odds and
 * settlement data together, so all three interface methods are served from the
 * same `/events` call and a short in-memory cache keeps credit usage flat.
 *
 * Field names follow the vendor's documented schema; every access is defensive
 * because the vendor adds fields over time.
 */

interface Envelope<T> {
  success: boolean;
  data: T;
  nextCursor?: string | null;
}

interface RawTeamNames {
  long?: string;
  medium?: string;
  short?: string;
}

interface RawTeam {
  teamID?: string;
  names?: RawTeamNames;
  colors?: { primary?: string; secondary?: string };
  score?: number;
}

interface RawOdd {
  oddID?: string;
  marketName?: string;
  statID?: string;
  betTypeID?: string;
  sideID?: string;
  periodID?: string;
  bookOverUnder?: string | number;
  bookSpread?: string | number;
  bookOdds?: string | number;
  fairOdds?: string | number;
  byBookmaker?: Record<
    string,
    { odds?: string | number; overUnder?: string | number; spread?: string | number; available?: boolean; lastUpdatedAt?: string }
  >;
}

interface RawEvent {
  eventID: string;
  sportID?: string;
  leagueID?: string;
  status?: {
    startsAt?: string;
    completed?: boolean;
    live?: boolean;
    cancelled?: boolean;
    delayed?: boolean;
    periodID?: string;
    clock?: string;
    displayShort?: string;
  };
  teams?: { home?: RawTeam; away?: RawTeam };
  results?: {
    game?: Record<string, number | undefined>;
    [period: string]: Record<string, number | undefined> | undefined;
  };
  odds?: Record<string, RawOdd>;
  venue?: { name?: string };
  info?: { seasonWeek?: string; season?: string };
}

interface RawLeague {
  leagueID: string;
  sportID: string;
  name?: string;
  shortName?: string;
  countryCode?: string;
}

interface RawSportEntry {
  sportID: string;
  name?: string;
}

const SPORT_MAP: Record<string, string> = {
  SOCCER: 'football',
  FOOTBALL: 'american-football',
  BASKETBALL: 'basketball',
  HOCKEY: 'ice-hockey',
  BASEBALL: 'baseball',
  TENNIS: 'tennis',
};

const BET_TYPE_MAP: Record<string, MarketType> = {
  ml: MarketType.MATCH_WINNER,
  ml3way: MarketType.MATCH_WINNER,
  sp: MarketType.ASIAN_HANDICAP,
  ou: MarketType.OVER_UNDER,
  eh: MarketType.EUROPEAN_HANDICAP,
  btts: MarketType.BTTS,
  dc: MarketType.DOUBLE_CHANCE,
};

export class SportsGameOddsProvider extends BaseProvider {
  readonly slug = 'sportsgameodds';
  readonly name = 'SportsGameOdds';

  private readonly http: HttpClient;
  private readonly enabledLeagueKeys: string[];
  private readonly cache = new Map<string, { at: number; events: RawEvent[] }>();
  private readonly cacheTtlMs = 15_000;

  constructor(config: ProviderConfig) {
    super();
    this.http = new HttpClient({
      baseUrl: config.baseUrl || 'https://api.sportsgameodds.com/v2',
      apiKey: config.apiKey ?? null,
      apiKeyHeader: 'X-Api-Key',
      timeoutMs: config.timeoutMs ?? 15_000,
      rateLimitPerMinute: config.rateLimitPerMinute ?? 60,
      fetchImpl: config.fetchImpl,
    });
    this.enabledLeagueKeys = config.enabledLeagueKeys ?? [];
  }

  async getSports(): Promise<ProviderSport[]> {
    const response = await this.http.get<Envelope<RawSportEntry[]>>('/sports/');
    return (response.data ?? []).map((sport) => ({
      key: SPORT_MAP[sport.sportID] ?? sport.sportID.toLowerCase(),
      name: sport.name ?? sport.sportID,
    }));
  }

  async getLeagues(sportKey?: string): Promise<ProviderLeague[]> {
    const response = await this.http.get<Envelope<RawLeague[]>>('/leagues/');
    return (response.data ?? [])
      .map((league) => ({
        providerLeagueId: league.leagueID,
        key: league.leagueID,
        name: league.name ?? league.leagueID,
        shortName: league.shortName ?? null,
        sportKey: SPORT_MAP[league.sportID] ?? league.sportID.toLowerCase(),
        countryCode: league.countryCode ?? null,
        logoUrl: null,
        season: null,
        tier: 1,
      }))
      .filter((league) => !sportKey || league.sportKey === sportKey);
  }

  async getTeams(leagueKey: string): Promise<ProviderTeam[]> {
    const events = await this.fetchEvents({ leagueKeys: [leagueKey] });
    const seen = new Map<string, ProviderTeam>();
    for (const event of events) {
      for (const side of ['home', 'away'] as const) {
        const team = this.toTeam(event, side);
        if (team && !seen.has(team.providerTeamId)) seen.set(team.providerTeamId, team);
      }
    }
    return [...seen.values()];
  }

  private cacheKey(query: EventQuery): string {
    return JSON.stringify({
      leagues: (query.leagueKeys ?? this.enabledLeagueKeys).sort(),
      from: query.from?.toISOString().slice(0, 13),
      to: query.to?.toISOString().slice(0, 13),
      live: query.live ?? false,
    });
  }

  private async fetchEvents(query: EventQuery): Promise<RawEvent[]> {
    const key = this.cacheKey(query);
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < this.cacheTtlMs) return cached.events;

    const leagueKeys = query.leagueKeys?.length ? query.leagueKeys : this.enabledLeagueKeys;
    const collected: RawEvent[] = [];

    const leagues = leagueKeys.length > 0 ? leagueKeys : [undefined];
    for (const leagueID of leagues) {
      let cursor: string | undefined;
      let pages = 0;
      do {
        const response = await this.http.get<Envelope<RawEvent[]>>('/events/', {
          leagueID,
          startsAfter: query.from?.toISOString(),
          startsBefore: query.to?.toISOString(),
          live: query.live ? 'true' : undefined,
          limit: Math.min(query.limit ?? 100, 100),
          cursor,
        });
        collected.push(...(response.data ?? []));
        cursor = response.nextCursor ?? undefined;
        pages += 1;
      } while (cursor && pages < 5);
    }

    this.cache.set(key, { at: Date.now(), events: collected });
    return collected;
  }

  private toTeam(event: RawEvent, side: 'home' | 'away'): ProviderTeam | null {
    const raw = event.teams?.[side];
    if (!raw) return null;
    const name = raw.names?.long ?? raw.names?.medium ?? raw.names?.short ?? raw.teamID ?? 'Unknown';
    return {
      providerTeamId: raw.teamID ?? slugify(name),
      name,
      shortName: raw.names?.medium ?? raw.names?.short ?? null,
      code: raw.names?.short?.slice(0, 4).toUpperCase() ?? null,
      sportKey: SPORT_MAP[event.sportID ?? ''] ?? 'football',
      countryCode: null,
      logoUrl: null,
      colorPrimary: raw.colors?.primary ?? null,
    };
  }

  private toStatus(event: RawEvent): EventStatus {
    const status = event.status;
    if (status?.cancelled) return 'CANCELLED';
    if (status?.completed) return 'FINISHED';
    if (status?.periodID === 'halftime') return 'HALFTIME';
    if (status?.live) return 'LIVE';
    if (status?.delayed) return 'POSTPONED';
    return 'SCHEDULED';
  }

  private toEvent(event: RawEvent): ProviderEvent | null {
    const home = this.toTeam(event, 'home');
    const away = this.toTeam(event, 'away');
    if (!home || !away || !event.status?.startsAt) return null;
    const game = event.results?.game ?? {};
    const firstHalf = (event.results?.['1h'] ?? event.results?.['half1']) as
      | Record<string, number | undefined>
      | undefined;

    return {
      providerEventId: event.eventID,
      sportKey: SPORT_MAP[event.sportID ?? ''] ?? 'football',
      leagueKey: event.leagueID ?? 'unknown',
      countryCode: null,
      startsAt: new Date(event.status.startsAt).toISOString(),
      status: this.toStatus(event),
      homeTeam: home,
      awayTeam: away,
      homeScore: numberOrNull(game.homePoints ?? event.teams?.home?.score),
      awayScore: numberOrNull(game.awayPoints ?? event.teams?.away?.score),
      htHomeScore: numberOrNull(firstHalf?.homePoints),
      htAwayScore: numberOrNull(firstHalf?.awayPoints),
      minute: parseClockMinute(event.status.clock),
      period: event.status.periodID ?? null,
      homeCorners: numberOrNull(game.homeCorners),
      awayCorners: numberOrNull(game.awayCorners),
      homeYellowCards: numberOrNull(game.homeYellowCards),
      awayYellowCards: numberOrNull(game.awayYellowCards),
      homeRedCards: numberOrNull(game.homeRedCards),
      awayRedCards: numberOrNull(game.awayRedCards),
      venue: event.venue?.name ?? null,
      round: event.info?.seasonWeek ?? null,
      season: event.info?.season ?? null,
      statistics: null,
    };
  }

  async getEvents(query: EventQuery = {}): Promise<ProviderEvent[]> {
    const raw = await this.fetchEvents(query);
    const events = raw
      .map((event) => this.toEvent(event))
      .filter((event): event is ProviderEvent => event !== null)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return query.limit ? events.slice(0, query.limit) : events;
  }

  override async getLiveEvents(): Promise<ProviderEvent[]> {
    return this.getEvents({ live: true });
  }

  async getOdds(query: OddsQuery): Promise<ProviderOdds[]> {
    const wanted = new Set(query.providerEventIds);
    const raw = await this.fetchEvents({});
    const odds: ProviderOdds[] = [];

    for (const event of raw) {
      if (!wanted.has(event.eventID)) continue;
      for (const entry of Object.values(event.odds ?? {})) {
        const marketType = BET_TYPE_MAP[entry.betTypeID ?? ''];
        if (!marketType) continue;
        if (query.marketTypes?.length && !query.marketTypes.includes(marketType)) continue;

        const selection = mapSide(entry.sideID, marketType);
        if (!selection) continue;

        for (const [bookmakerKey, book] of Object.entries(entry.byBookmaker ?? {})) {
          if (query.bookmakerKeys?.length && !query.bookmakerKeys.includes(bookmakerKey)) continue;
          const price = toNumber(book.odds ?? entry.bookOdds);
          if (price === null || price <= 1) continue;
          odds.push({
            providerEventId: event.eventID,
            bookmakerKey,
            bookmakerName: prettifyBookmaker(bookmakerKey),
            marketType,
            marketKey: entry.statID ? `${entry.statID}:${entry.betTypeID}` : (entry.betTypeID ?? 'unknown'),
            selection,
            line:
              toNumber(book.overUnder ?? entry.bookOverUnder) ??
              toNumber(book.spread ?? entry.bookSpread) ??
              0,
            price,
            isSuspended: book.available === false,
            lastUpdate: book.lastUpdatedAt ?? new Date().toISOString(),
          });
        }
      }
    }
    return odds;
  }

  async getResults(query: ResultQuery): Promise<ProviderResult[]> {
    const wanted = new Set(query.providerEventIds);
    const raw = await this.fetchEvents({});
    const results: ProviderResult[] = [];

    for (const event of raw) {
      if (!wanted.has(event.eventID) || !event.status?.completed) continue;
      const game = event.results?.game ?? {};
      const homeScore = numberOrNull(game.homePoints);
      const awayScore = numberOrNull(game.awayPoints);
      if (homeScore === null || awayScore === null) continue;
      const firstHalf = (event.results?.['1h'] ?? event.results?.['half1']) as
        | Record<string, number | undefined>
        | undefined;

      results.push({
        providerEventId: event.eventID,
        status: 'FINISHED',
        homeScore,
        awayScore,
        htHomeScore: numberOrNull(firstHalf?.homePoints),
        htAwayScore: numberOrNull(firstHalf?.awayPoints),
        homeCorners: numberOrNull(game.homeCorners),
        awayCorners: numberOrNull(game.awayCorners),
        homeCards: sumOrNull(game.homeYellowCards, game.homeRedCards),
        awayCards: sumOrNull(game.awayYellowCards, game.awayRedCards),
        finishedAt: null,
        raw: event.results,
      });
    }
    return results;
  }
}

function mapSide(sideID: string | undefined, marketType: MarketType): string | null {
  if (!sideID) return null;
  const side = sideID.toLowerCase();
  if (marketType === MarketType.OVER_UNDER || marketType === MarketType.TEAM_TOTAL) {
    if (side === 'over') return 'OVER';
    if (side === 'under') return 'UNDER';
    return null;
  }
  if (marketType === MarketType.BTTS) {
    if (side === 'yes') return 'BTTS_YES';
    if (side === 'no') return 'BTTS_NO';
    return null;
  }
  if (marketType === MarketType.DOUBLE_CHANCE) {
    if (side === 'home_draw' || side === '1x') return 'HOME_OR_DRAW';
    if (side === 'away_draw' || side === 'x2') return 'AWAY_OR_DRAW';
    if (side === 'home_away' || side === '12') return 'HOME_OR_AWAY';
    return null;
  }
  if (side === 'home') return 'HOME';
  if (side === 'away') return 'AWAY';
  if (side === 'draw') return 'DRAW';
  return null;
}

function toNumber(value: string | number | undefined): number | null {
  if (value === undefined || value === null) return null;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value.replace('+', ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOrNull(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sumOrNull(a: number | undefined, b: number | undefined): number | null {
  if (a === undefined && b === undefined) return null;
  return (a ?? 0) + (b ?? 0);
}

function parseClockMinute(clock: string | undefined): number | null {
  if (!clock) return null;
  const match = /^(\d{1,3})/.exec(clock);
  return match ? Number(match[1]) : null;
}

function prettifyBookmaker(key: string): string {
  return key
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
