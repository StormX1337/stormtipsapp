import type {
  EventQuery,
  OddsQuery,
  ProviderEvent,
  ProviderHealth,
  ProviderLeague,
  ProviderOdds,
  ProviderResult,
  ProviderSport,
  ProviderTeam,
  ResultQuery,
} from './types.js';

/**
 * The contract every sports/odds vendor adapter implements.
 *
 * Deliberately small: fixtures, odds and results are the only three things the
 * platform needs from a vendor. Anything richer stays in the adapter.
 */
export interface SportsDataProvider {
  readonly slug: string;
  readonly name: string;
  /** True when the adapter needs no network access (mock provider). */
  readonly offline: boolean;

  getSports(): Promise<ProviderSport[]>;
  getLeagues(sportKey?: string): Promise<ProviderLeague[]>;
  getTeams(leagueKey: string): Promise<ProviderTeam[]>;
  getEvents(query?: EventQuery): Promise<ProviderEvent[]>;
  getLiveEvents(): Promise<ProviderEvent[]>;
  getOdds(query: OddsQuery): Promise<ProviderOdds[]>;
  getResults(query: ResultQuery): Promise<ProviderResult[]>;
  healthCheck(): Promise<ProviderHealth>;
}

export abstract class BaseProvider implements SportsDataProvider {
  abstract readonly slug: string;
  abstract readonly name: string;
  readonly offline: boolean = false;

  abstract getSports(): Promise<ProviderSport[]>;
  abstract getLeagues(sportKey?: string): Promise<ProviderLeague[]>;
  abstract getTeams(leagueKey: string): Promise<ProviderTeam[]>;
  abstract getEvents(query?: EventQuery): Promise<ProviderEvent[]>;
  abstract getOdds(query: OddsQuery): Promise<ProviderOdds[]>;
  abstract getResults(query: ResultQuery): Promise<ProviderResult[]>;

  /** Default live implementation: filter the fixture feed. Override when the vendor has a live endpoint. */
  async getLiveEvents(): Promise<ProviderEvent[]> {
    const events = await this.getEvents({ live: true });
    return events.filter((event) => event.status === 'LIVE' || event.status === 'HALFTIME');
  }

  async healthCheck(): Promise<ProviderHealth> {
    const started = Date.now();
    try {
      await this.getSports();
      return { ok: true, slug: this.slug, latencyMs: Date.now() - started };
    } catch (error) {
      return {
        ok: false,
        slug: this.slug,
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : 'unknown error',
      };
    }
  }
}
