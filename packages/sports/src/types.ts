import type { EventStatus, MarketType } from '@storm-tips/types';

/**
 * Normalised provider DTOs.
 *
 * Every adapter maps its vendor payload onto these shapes, so the rest of the
 * platform never sees a vendor-specific field. Adding a provider therefore
 * never requires a change outside `packages/sports`.
 */

export interface ProviderSport {
  key: string;
  name: string;
  icon?: string | null;
}

export interface ProviderCountry {
  code: string;
  name: string;
  flagEmoji?: string | null;
}

export interface ProviderLeague {
  providerLeagueId: string;
  key: string;
  name: string;
  shortName?: string | null;
  sportKey: string;
  countryCode?: string | null;
  logoUrl?: string | null;
  season?: string | null;
  tier?: number;
}

export interface ProviderTeam {
  providerTeamId: string;
  name: string;
  shortName?: string | null;
  code?: string | null;
  sportKey: string;
  countryCode?: string | null;
  logoUrl?: string | null;
  colorPrimary?: string | null;
}

export interface ProviderEvent {
  providerEventId: string;
  sportKey: string;
  leagueKey: string;
  countryCode?: string | null;
  startsAt: string;
  status: EventStatus;
  homeTeam: ProviderTeam;
  awayTeam: ProviderTeam;
  homeScore?: number | null;
  awayScore?: number | null;
  htHomeScore?: number | null;
  htAwayScore?: number | null;
  minute?: number | null;
  period?: string | null;
  homeRedCards?: number | null;
  awayRedCards?: number | null;
  homeYellowCards?: number | null;
  awayYellowCards?: number | null;
  homeCorners?: number | null;
  awayCorners?: number | null;
  venue?: string | null;
  round?: string | null;
  season?: string | null;
  statistics?: Record<string, unknown> | null;
}

export interface ProviderOdds {
  providerEventId: string;
  bookmakerKey: string;
  bookmakerName: string;
  marketType: MarketType;
  marketKey: string;
  selection: string;
  line: number;
  price: number;
  isSuspended?: boolean;
  lastUpdate: string;
}

export interface ProviderResult {
  providerEventId: string;
  status: EventStatus;
  homeScore: number;
  awayScore: number;
  htHomeScore?: number | null;
  htAwayScore?: number | null;
  homeCorners?: number | null;
  awayCorners?: number | null;
  homeCards?: number | null;
  awayCards?: number | null;
  finishedAt?: string | null;
  raw?: unknown;
}

export interface EventQuery {
  sportKey?: string;
  leagueKeys?: string[];
  from?: Date;
  to?: Date;
  live?: boolean;
  limit?: number;
}

export interface OddsQuery {
  providerEventIds: string[];
  marketTypes?: MarketType[];
  bookmakerKeys?: string[];
}

export interface ResultQuery {
  providerEventIds: string[];
}

export interface ProviderConfig {
  slug: string;
  apiKey?: string | null;
  baseUrl?: string | null;
  enabledSports?: string[];
  enabledLeagueKeys?: string[];
  rateLimitPerMinute?: number;
  timeoutMs?: number;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

export interface ProviderHealth {
  ok: boolean;
  slug: string;
  latencyMs: number;
  message?: string;
  quotaRemaining?: number | null;
}
