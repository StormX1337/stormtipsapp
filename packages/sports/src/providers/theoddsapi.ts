import { MarketType, type EventStatus } from '@storm-tips/types';
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

/** Raw payloads from The Odds API v4 (https://the-odds-api.com/liveapi/guides/v4/). */
interface RawSport {
  key: string;
  group: string;
  title: string;
  description?: string;
  active: boolean;
  has_outrights: boolean;
}

interface RawOutcome {
  name: string;
  price: number;
  point?: number;
  description?: string;
}

interface RawMarket {
  key: string;
  last_update: string;
  outcomes: RawOutcome[];
}

interface RawBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: RawMarket[];
}

interface RawEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: RawBookmaker[];
}

interface RawScoreEntry {
  name: string;
  score: string;
}

interface RawScore {
  id: string;
  sport_key: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: RawScoreEntry[] | null;
  last_update: string | null;
}

const MARKET_MAP: Record<string, MarketType> = {
  h2h: MarketType.MATCH_WINNER,
  totals: MarketType.OVER_UNDER,
  spreads: MarketType.ASIAN_HANDICAP,
  btts: MarketType.BTTS,
  double_chance: MarketType.DOUBLE_CHANCE,
  team_totals: MarketType.TEAM_TOTAL,
  alternate_totals: MarketType.OVER_UNDER,
  alternate_spreads: MarketType.ASIAN_HANDICAP,
};

/**
 * The Odds API adapter.
 *
 * Credit model is per request, so the adapter batches by sport (the vendor has
 * no multi-event endpoint) and shares one odds response between `getEvents`
 * and `getOdds` through a short-lived in-memory cache.
 */
export class TheOddsApiProvider extends BaseProvider {
  readonly slug = 'theoddsapi';
  readonly name = 'The Odds API';

  private readonly http: HttpClient;
  private readonly enabledSports: string[];
  private readonly cache = new Map<string, { at: number; events: RawEvent[] }>();
  private readonly cacheTtlMs = 20_000;

  constructor(config: ProviderConfig) {
    super();
    this.http = new HttpClient({
      baseUrl: config.baseUrl || 'https://api.the-odds-api.com/v4',
      apiKey: config.apiKey ?? null,
      apiKeyQueryParam: 'apiKey',
      timeoutMs: config.timeoutMs ?? 12_000,
      rateLimitPerMinute: config.rateLimitPerMinute ?? 30,
      fetchImpl: config.fetchImpl,
    });
    this.enabledSports = config.enabledSports?.length
      ? config.enabledSports
      : ['soccer_epl', 'soccer_germany_bundesliga', 'soccer_spain_la_liga', 'soccer_italy_serie_a'];
  }

  async getSports(): Promise<ProviderSport[]> {
    const raw = await this.http.get<RawSport[]>('/sports', { all: 'false' });
    const groups = new Map<string, ProviderSport>();
    for (const sport of raw) {
      const key = normaliseGroup(sport.group);
      if (!groups.has(key)) groups.set(key, { key, name: sport.group });
    }
    return [...groups.values()];
  }

  async getLeagues(sportKey?: string): Promise<ProviderLeague[]> {
    const raw = await this.http.get<RawSport[]>('/sports', { all: 'false' });
    return raw
      .filter((sport) => sport.active && !sport.has_outrights)
      .filter((sport) => !sportKey || normaliseGroup(sport.group) === sportKey)
      .map((sport) => ({
        providerLeagueId: sport.key,
        key: sport.key,
        name: sport.title,
        shortName: null,
        sportKey: normaliseGroup(sport.group),
        countryCode: null,
        logoUrl: null,
        season: null,
        tier: 1,
      }));
  }

  /** The vendor exposes no team endpoint; teams are derived from fixtures. */
  async getTeams(leagueKey: string): Promise<ProviderTeam[]> {
    const events = await this.fetchEvents(leagueKey);
    const sportKey = normaliseGroup(leagueKey);
    const seen = new Map<string, ProviderTeam>();
    for (const event of events) {
      for (const name of [event.home_team, event.away_team]) {
        if (!seen.has(name)) {
          seen.set(name, {
            providerTeamId: slugify(name),
            name,
            shortName: name,
            code: name.slice(0, 3).toUpperCase(),
            sportKey,
            countryCode: null,
            logoUrl: null,
            colorPrimary: null,
          });
        }
      }
    }
    return [...seen.values()];
  }

  private async fetchEvents(leagueKey: string): Promise<RawEvent[]> {
    const cached = this.cache.get(leagueKey);
    if (cached && Date.now() - cached.at < this.cacheTtlMs) return cached.events;
    const events = await this.http.get<RawEvent[]>(`/sports/${leagueKey}/odds`, {
      regions: 'eu,uk',
      markets: 'h2h,totals,spreads',
      oddsFormat: 'decimal',
      dateFormat: 'iso',
    });
    this.cache.set(leagueKey, { at: Date.now(), events });
    return events;
  }

  async getEvents(query: EventQuery = {}): Promise<ProviderEvent[]> {
    const leagueKeys = query.leagueKeys?.length ? query.leagueKeys : this.enabledSports;
    const all: ProviderEvent[] = [];
    for (const leagueKey of leagueKeys) {
      const raw = await this.fetchEvents(leagueKey);
      for (const event of raw) {
        const startsAt = new Date(event.commence_time);
        if (query.from && startsAt < query.from) continue;
        if (query.to && startsAt > query.to) continue;
        all.push(this.toEvent(event, leagueKey));
      }
    }
    all.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return query.limit ? all.slice(0, query.limit) : all;
  }

  private toEvent(event: RawEvent, leagueKey: string): ProviderEvent {
    const sportKey = normaliseGroup(event.sport_key);
    const startsAt = new Date(event.commence_time);
    const status: EventStatus = startsAt.getTime() > Date.now() ? 'SCHEDULED' : 'LIVE';
    const team = (name: string): ProviderTeam => ({
      providerTeamId: slugify(name),
      name,
      shortName: name,
      code: name.slice(0, 3).toUpperCase(),
      sportKey,
      countryCode: null,
      logoUrl: null,
      colorPrimary: null,
    });
    return {
      providerEventId: event.id,
      sportKey,
      leagueKey,
      countryCode: null,
      startsAt: startsAt.toISOString(),
      status,
      homeTeam: team(event.home_team),
      awayTeam: team(event.away_team),
      homeScore: null,
      awayScore: null,
      minute: null,
      venue: null,
      round: null,
      season: null,
    };
  }

  async getOdds(query: OddsQuery): Promise<ProviderOdds[]> {
    const wanted = new Set(query.providerEventIds);
    const odds: ProviderOdds[] = [];

    for (const leagueKey of this.enabledSports) {
      const events = await this.fetchEvents(leagueKey);
      for (const event of events) {
        if (!wanted.has(event.id)) continue;
        for (const bookmaker of event.bookmakers ?? []) {
          if (query.bookmakerKeys?.length && !query.bookmakerKeys.includes(bookmaker.key)) continue;
          for (const market of bookmaker.markets) {
            const marketType = MARKET_MAP[market.key];
            if (!marketType) continue;
            if (query.marketTypes?.length && !query.marketTypes.includes(marketType)) continue;
            for (const outcome of market.outcomes) {
              odds.push({
                providerEventId: event.id,
                bookmakerKey: bookmaker.key,
                bookmakerName: bookmaker.title,
                marketType,
                marketKey: market.key,
                selection: normaliseSelection(market.key, outcome, event),
                line: outcome.point ?? 0,
                price: outcome.price,
                isSuspended: false,
                lastUpdate: market.last_update ?? bookmaker.last_update,
              });
            }
          }
        }
      }
    }
    return odds;
  }

  async getResults(query: ResultQuery): Promise<ProviderResult[]> {
    const wanted = new Set(query.providerEventIds);
    const results: ProviderResult[] = [];

    for (const leagueKey of this.enabledSports) {
      const scores = await this.http.get<RawScore[]>(`/sports/${leagueKey}/scores`, {
        daysFrom: 3,
        dateFormat: 'iso',
      });
      for (const score of scores) {
        if (!wanted.has(score.id) || !score.completed || !score.scores) continue;
        const home = score.scores.find((entry) => entry.name === score.home_team);
        const away = score.scores.find((entry) => entry.name === score.away_team);
        if (!home || !away) continue;
        results.push({
          providerEventId: score.id,
          status: 'FINISHED',
          homeScore: Number(home.score),
          awayScore: Number(away.score),
          finishedAt: score.last_update,
          raw: score,
        });
      }
    }
    return results;
  }
}

function normaliseGroup(value: string): string {
  if (value.toLowerCase().startsWith('soccer')) return 'football';
  if (value.toLowerCase().includes('ice hockey')) return 'ice-hockey';
  return value.toLowerCase().replace(/\s+/g, '-');
}

function normaliseSelection(marketKey: string, outcome: RawOutcome, event: RawEvent): string {
  const name = outcome.name;
  if (marketKey === 'h2h') {
    if (name === event.home_team) return 'HOME';
    if (name === event.away_team) return 'AWAY';
    return 'DRAW';
  }
  if (marketKey === 'totals' || marketKey === 'alternate_totals') {
    return name.toLowerCase() === 'over' ? 'OVER' : 'UNDER';
  }
  if (marketKey === 'spreads' || marketKey === 'alternate_spreads') {
    return name === event.home_team ? 'HOME' : 'AWAY';
  }
  if (marketKey === 'btts') return name.toLowerCase() === 'yes' ? 'BTTS_YES' : 'BTTS_NO';
  return name.toUpperCase().replace(/\s+/g, '_');
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
