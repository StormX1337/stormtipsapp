import type { Prisma } from '@profit-tips/database';
import type { CountryDTO, EventDTO, LeagueDTO, SportDTO, TeamDTO, BookmakerDTO, OddDTO } from '@profit-tips/types';
import { dec, iso } from './common.js';

export const leagueInclude = { sport: true, country: true } satisfies Prisma.LeagueInclude;
export type LeagueWithRelations = Prisma.LeagueGetPayload<{ include: typeof leagueInclude }>;

export const eventInclude = {
  homeTeam: true,
  awayTeam: true,
  league: { include: leagueInclude },
} satisfies Prisma.EventInclude;
export type EventWithRelations = Prisma.EventGetPayload<{ include: typeof eventInclude }>;

export function serializeSport(sport: Prisma.SportGetPayload<object>): SportDTO {
  return { id: sport.id, key: sport.key, name: sport.name, icon: sport.icon };
}

export function serializeCountry(country: Prisma.CountryGetPayload<object> | null): CountryDTO | null {
  if (!country) return null;
  return {
    id: country.id,
    code: country.code,
    name: country.name,
    flagEmoji: country.flagEmoji,
    flagUrl: country.flagUrl,
  };
}

export function serializeLeague(league: LeagueWithRelations): LeagueDTO {
  return {
    id: league.id,
    key: league.key,
    name: league.name,
    shortName: league.shortName,
    logoUrl: league.logoUrl,
    sport: serializeSport(league.sport),
    country: serializeCountry(league.country),
    priority: league.priority,
  };
}

export function serializeTeam(team: Prisma.TeamGetPayload<object>): TeamDTO {
  return {
    id: team.id,
    name: team.name,
    shortName: team.shortName,
    code: team.code,
    logoUrl: team.logoUrl,
    colorPrimary: team.colorPrimary,
  };
}

export function serializeEvent(event: EventWithRelations): EventDTO {
  return {
    id: event.id,
    startsAt: event.startsAt.toISOString(),
    status: event.status,
    minute: event.minute,
    period: event.period,
    homeScore: event.homeScore,
    awayScore: event.awayScore,
    htHomeScore: event.htHomeScore,
    htAwayScore: event.htAwayScore,
    homeRedCards: event.homeRedCards,
    awayRedCards: event.awayRedCards,
    venue: event.venue,
    round: event.round,
    homeTeam: serializeTeam(event.homeTeam),
    awayTeam: serializeTeam(event.awayTeam),
    league: serializeLeague(event.league),
  };
}

export function serializeBookmaker(
  bookmaker: Prisma.BookmakerGetPayload<object> | null,
): BookmakerDTO | null {
  if (!bookmaker) return null;
  return {
    id: bookmaker.id,
    key: bookmaker.key,
    name: bookmaker.name,
    logoUrl: bookmaker.logoUrl,
    color: bookmaker.color,
    website: bookmaker.website,
  };
}

export const oddInclude = { bookmaker: true, market: true } satisfies Prisma.OddInclude;
export type OddWithRelations = Prisma.OddGetPayload<{ include: typeof oddInclude }>;

export function serializeOdd(odd: OddWithRelations): OddDTO {
  return {
    id: odd.id,
    bookmaker: serializeBookmaker(odd.bookmaker)!,
    marketType: odd.market.type,
    selection: odd.selection,
    line: dec(odd.line) ?? 0,
    price: dec(odd.price) ?? 0,
    openingPrice: dec(odd.openingPrice) ?? 0,
    closingPrice: dec(odd.closingPrice),
    movement: odd.movement,
    isSuspended: odd.isSuspended,
    lastUpdate: iso(odd.lastUpdate)!,
  };
}
