import { prisma, type Prisma } from '@storm-tips/database';
import {
  CATALOGUE_COUNTRIES,
  classifyMovement,
  createProviderWithFallback,
  relativeDelta,
  type ProviderEvent,
  type ProviderOdds,
  type SportsDataProvider,
} from '@storm-tips/sports';
import { decryptSecret } from '@storm-tips/auth';
import { flagEmoji } from '@storm-tips/ui';
import type { MarketType } from '@storm-tips/types';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

export interface SyncSummary {
  provider: string;
  fellBack: boolean;
  leagues: number;
  teams: number;
  events: number;
  odds: number;
  results: number;
  errors: string[];
}

const emptySummary = (provider: string, fellBack = false): SyncSummary => ({
  provider,
  fellBack,
  leagues: 0,
  teams: 0,
  events: 0,
  odds: 0,
  results: 0,
  errors: [],
});

/** Provider market type → our seeded market key. */
const MARKET_KEY_BY_TYPE: Partial<Record<MarketType, string>> = {
  MATCH_WINNER: '1x2',
  DOUBLE_CHANCE: 'double-chance',
  DRAW_NO_BET: 'dnb',
  OVER_UNDER: 'totals',
  TEAM_TOTAL: 'team-totals',
  ASIAN_HANDICAP: 'asian-handicap',
  EUROPEAN_HANDICAP: 'european-handicap',
  BTTS: 'btts',
  HALF_OVER_UNDER: 'ht-totals',
  CORNERS: 'corners',
  CARDS: 'cards',
};

/**
 * Ingests fixtures, odds and results from the configured sports provider.
 *
 * The provider is selected from the database (`api_providers`) so it can be
 * switched, re-keyed or disabled from the admin console without a deploy; the
 * environment is only the fallback.
 */
export class SyncService {
  /** Resolves the active provider, decrypting its stored API key. */
  async resolveProvider(
    slug?: string,
  ): Promise<{ provider: SportsDataProvider; fellBack: boolean }> {
    const row = slug
      ? await prisma.apiProvider.findUnique({ where: { slug } })
      : await prisma.apiProvider.findFirst({
          where: { kind: { in: ['SPORTS', 'ODDS'] }, isActive: true },
          orderBy: { priority: 'asc' },
        });

    if (!row) {
      const resolved = createProviderWithFallback({
        slug: env.SPORTS_PROVIDER,
        apiKey: env.SPORTS_API_KEY ?? null,
        baseUrl: env.SPORTS_API_BASE_URL ?? null,
      });
      return { provider: resolved.provider, fellBack: resolved.fellBack };
    }

    let apiKey: string | null = null;
    if (row.apiKeyEncrypted) {
      try {
        apiKey = decryptSecret(row.apiKeyEncrypted, env.ENCRYPTION_KEY);
      } catch {
        /**
         * AES-GCM authenticates the ciphertext, so the only way this fails on
         * an unmodified row is that ENCRYPTION_KEY is no longer the key it was
         * stored with. Saying so is the difference between a one-line fix and
         * an afternoon: the key has to be re-entered in the admin console, it
         * cannot be recovered.
         */
        logger.error(
          { slug: row.slug },
          'stored API key cannot be decrypted with the current ENCRYPTION_KEY — ' +
            're-enter it under Admin → API providers',
        );
      }
    }

    const resolved = createProviderWithFallback({
      slug: row.slug,
      apiKey: apiKey ?? env.SPORTS_API_KEY ?? null,
      baseUrl: row.baseUrl ?? undefined,
      enabledSports: row.enabledSports,
      enabledLeagueKeys: row.enabledLeagueIds,
      rateLimitPerMinute: row.rateLimitPerMinute,
    });
    return { provider: resolved.provider, fellBack: resolved.fellBack };
  }

  private async upsertEvent(
    event: ProviderEvent,
    cache: {
      sports: Map<string, string>;
      countries: Map<string, string>;
      leagues: Map<string, string>;
      teams: Map<string, string>;
    },
    summary: SyncSummary,
  ): Promise<string | null> {
    let sportId = cache.sports.get(event.sportKey);
    if (!sportId) {
      const sport = await prisma.sport.upsert({
        where: { key: event.sportKey },
        create: { key: event.sportKey, name: event.sportKey },
        update: {},
      });
      sportId = sport.id;
      cache.sports.set(event.sportKey, sportId);
    }

    let countryId: string | null = null;
    if (event.countryCode) {
      countryId = cache.countries.get(event.countryCode) ?? null;
      if (!countryId) {
        /**
         * Providers send a bare country code. Without this the row is created
         * with the code as its name and no flag, which is what the apps then
         * render — a grey "IT" box where a flag belongs.
         */
        const known = CATALOGUE_COUNTRIES.find((entry) => entry.code === event.countryCode);
        const country = await prisma.country.upsert({
          where: { code: event.countryCode },
          create: {
            code: event.countryCode,
            name: known?.name ?? event.countryCode,
            flagEmoji: known?.flagEmoji ?? flagEmoji(event.countryCode),
          },
          update: {},
        });
        countryId = country.id;
        cache.countries.set(event.countryCode, countryId);
      }
    }

    let leagueId = cache.leagues.get(`${event.sportKey}:${event.leagueKey}`);
    if (!leagueId) {
      const league = await prisma.league.upsert({
        where: { sportId_key: { sportId, key: event.leagueKey } },
        create: {
          sportId,
          countryId,
          key: event.leagueKey,
          name: event.leagueKey,
          providerLeagueId: event.leagueKey,
        },
        update: { countryId: countryId ?? undefined },
      });
      leagueId = league.id;
      cache.leagues.set(`${event.sportKey}:${event.leagueKey}`, leagueId);
      summary.leagues += 1;
    }

    const teamIds: string[] = [];
    for (const team of [event.homeTeam, event.awayTeam]) {
      const key = `${event.sportKey}:${team.name}`;
      let teamId = cache.teams.get(key);
      if (!teamId) {
        const row = await prisma.team.upsert({
          where: { sportId_name: { sportId, name: team.name } },
          create: {
            sportId,
            countryId,
            leagueId,
            providerTeamId: team.providerTeamId,
            name: team.name,
            shortName: team.shortName ?? null,
            code: team.code ?? null,
            logoUrl: team.logoUrl ?? null,
            colorPrimary: team.colorPrimary ?? null,
          },
          update: {
            logoUrl: team.logoUrl ?? undefined,
            colorPrimary: team.colorPrimary ?? undefined,
          },
        });
        teamId = row.id;
        cache.teams.set(key, teamId);
        summary.teams += 1;
      }
      teamIds.push(teamId);
    }

    const [homeTeamId, awayTeamId] = teamIds;
    if (!homeTeamId || !awayTeamId) return null;

    const data = {
      providerEventId: event.providerEventId,
      sportId,
      leagueId,
      homeTeamId,
      awayTeamId,
      startsAt: new Date(event.startsAt),
      status: event.status,
      minute: event.minute ?? null,
      period: event.period ?? null,
      homeScore: event.homeScore ?? null,
      awayScore: event.awayScore ?? null,
      htHomeScore: event.htHomeScore ?? null,
      htAwayScore: event.htAwayScore ?? null,
      homeCorners: event.homeCorners ?? null,
      awayCorners: event.awayCorners ?? null,
      homeYellowCards: event.homeYellowCards ?? null,
      awayYellowCards: event.awayYellowCards ?? null,
      homeRedCards: event.homeRedCards ?? null,
      awayRedCards: event.awayRedCards ?? null,
      venue: event.venue ?? null,
      round: event.round ?? null,
      season: event.season ?? null,
    } satisfies Prisma.EventUncheckedCreateInput;

    const row = await prisma.event.upsert({
      where: { providerSlug: event.providerEventId },
      create: { ...data, providerSlug: event.providerEventId },
      update: data,
    });
    summary.events += 1;
    return row.id;
  }

  /** Pulls fixtures for a window around today. */
  async syncFixtures(
    options: { providerSlug?: string; daysBack?: number; daysForward?: number } = {},
  ): Promise<SyncSummary> {
    const { provider, fellBack } = await this.resolveProvider(options.providerSlug);
    const summary = emptySummary(provider.slug, fellBack);

    const from = new Date(Date.now() - (options.daysBack ?? 2) * 86_400_000);
    const to = new Date(Date.now() + (options.daysForward ?? 7) * 86_400_000);

    try {
      const events = await provider.getEvents({ from, to });
      const cache = {
        sports: new Map<string, string>(),
        countries: new Map<string, string>(),
        leagues: new Map<string, string>(),
        teams: new Map<string, string>(),
      };
      for (const event of events) {
        await this.upsertEvent(event, cache, summary);
      }
      await this.recordSync(provider.slug, null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.errors.push(message);
      await this.recordSync(provider.slug, message);
      logger.error({ err: error }, 'fixture sync failed');
    }

    return summary;
  }

  /** Refreshes odds for upcoming fixtures and appends a history point on change. */
  async syncOdds(
    options: { providerSlug?: string; eventIds?: string[] } = {},
  ): Promise<SyncSummary> {
    const { provider, fellBack } = await this.resolveProvider(options.providerSlug);
    const summary = emptySummary(provider.slug, fellBack);

    const events = await prisma.event.findMany({
      where: {
        ...(options.eventIds?.length ? { id: { in: options.eventIds } } : {}),
        startsAt: {
          gte: new Date(Date.now() - 3_600_000),
          lte: new Date(Date.now() + 7 * 86_400_000),
        },
        status: { in: ['SCHEDULED', 'LIVE', 'HALFTIME'] },
        providerEventId: { not: null },
      },
      select: { id: true, providerEventId: true },
      take: 300,
    });
    if (events.length === 0) return summary;

    const byProviderId = new Map(
      events.map((event) => [event.providerEventId as string, event.id]),
    );

    let providerOdds: ProviderOdds[] = [];
    try {
      providerOdds = await provider.getOdds({ providerEventIds: [...byProviderId.keys()] });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.errors.push(message);
      await this.recordSync(provider.slug, message);
      return summary;
    }

    const [markets, bookmakers] = await Promise.all([
      prisma.market.findMany(),
      prisma.bookmaker.findMany(),
    ]);
    const marketByKey = new Map(markets.map((market) => [market.key, market.id]));
    const bookmakerByKey = new Map(bookmakers.map((bookmaker) => [bookmaker.key, bookmaker.id]));

    for (const entry of providerOdds) {
      const eventId = byProviderId.get(entry.providerEventId);
      if (!eventId) continue;

      const marketKey = MARKET_KEY_BY_TYPE[entry.marketType];
      const marketId = marketKey ? marketByKey.get(marketKey) : undefined;
      if (!marketId) continue;

      let bookmakerId = bookmakerByKey.get(entry.bookmakerKey);
      if (!bookmakerId) {
        const created = await prisma.bookmaker.upsert({
          where: { key: entry.bookmakerKey },
          create: { key: entry.bookmakerKey, name: entry.bookmakerName },
          update: {},
        });
        bookmakerId = created.id;
        bookmakerByKey.set(entry.bookmakerKey, bookmakerId);
      }

      const identity = {
        eventId,
        bookmakerId,
        marketId,
        selection: entry.selection,
        line: entry.line,
      };

      const existing = await prisma.odd.findUnique({
        where: { eventId_bookmakerId_marketId_selection_line: identity },
      });

      if (!existing) {
        await prisma.odd.create({
          data: {
            ...identity,
            price: entry.price,
            openingPrice: entry.price,
            movement: 'STABLE',
            isSuspended: entry.isSuspended ?? false,
            lastUpdate: new Date(entry.lastUpdate),
          },
        });
        summary.odds += 1;
        continue;
      }

      const previous = Number(existing.price);
      if (Math.abs(previous - entry.price) < 0.001) continue;

      const opening = Number(existing.openingPrice);
      await prisma.$transaction([
        prisma.odd.update({
          where: { id: existing.id },
          data: {
            price: entry.price,
            movement: classifyMovement(opening, entry.price, env.ODDS_MOVEMENT_THRESHOLD),
            isSuspended: entry.isSuspended ?? false,
            lastUpdate: new Date(entry.lastUpdate),
          },
        }),
        prisma.oddsHistory.create({
          data: {
            oddId: existing.id,
            price: entry.price,
            delta: relativeDelta(previous, entry.price),
          },
        }),
      ]);
      summary.odds += 1;
    }

    await this.recordSync(provider.slug, summary.errors[0] ?? null);
    return summary;
  }

  /** Freezes the closing price for fixtures that have just kicked off. */
  async freezeClosingOdds(): Promise<number> {
    const result = await prisma.$executeRaw`
      UPDATE odds o
      SET "closingPrice" = o.price
      FROM events e
      WHERE o."eventId" = e.id
        AND o."closingPrice" IS NULL
        AND e."startsAt" <= NOW()
    `;
    return Number(result);
  }

  /** Pulls final scores for fixtures that should have finished. */
  async syncResults(
    options: { providerSlug?: string; eventIds?: string[] } = {},
  ): Promise<SyncSummary> {
    const { provider, fellBack } = await this.resolveProvider(options.providerSlug);
    const summary = emptySummary(provider.slug, fellBack);

    const events = await prisma.event.findMany({
      where: {
        ...(options.eventIds?.length ? { id: { in: options.eventIds } } : {}),
        status: { in: ['SCHEDULED', 'LIVE', 'HALFTIME'] },
        startsAt: {
          lte: new Date(Date.now() - 100 * 60_000),
          gte: new Date(Date.now() - 7 * 86_400_000),
        },
        providerEventId: { not: null },
      },
      select: { id: true, providerEventId: true },
      take: 300,
    });
    if (events.length === 0) return summary;

    const byProviderId = new Map(
      events.map((event) => [event.providerEventId as string, event.id]),
    );

    try {
      const results = await provider.getResults({ providerEventIds: [...byProviderId.keys()] });
      for (const result of results) {
        const eventId = byProviderId.get(result.providerEventId);
        if (!eventId) continue;
        await prisma.event.update({
          where: { id: eventId },
          data: {
            status: result.status,
            homeScore: result.homeScore,
            awayScore: result.awayScore,
            htHomeScore: result.htHomeScore ?? undefined,
            htAwayScore: result.htAwayScore ?? undefined,
            homeCorners: result.homeCorners ?? undefined,
            awayCorners: result.awayCorners ?? undefined,
            resultSyncedAt: new Date(),
            raw: (result.raw ?? undefined) as never,
          },
        });
        summary.results += 1;
      }
      await this.recordSync(provider.slug, null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.errors.push(message);
      await this.recordSync(provider.slug, message);
      logger.error({ err: error }, 'result sync failed');
    }

    return summary;
  }

  /** Refreshes in-play scores for fixtures currently live. */
  async syncLive(options: { providerSlug?: string } = {}): Promise<ProviderEvent[]> {
    const { provider } = await this.resolveProvider(options.providerSlug);
    const live = await provider.getLiveEvents();
    for (const event of live) {
      await prisma.event.updateMany({
        where: { providerEventId: event.providerEventId },
        data: {
          status: event.status,
          minute: event.minute ?? null,
          period: event.period ?? null,
          homeScore: event.homeScore ?? null,
          awayScore: event.awayScore ?? null,
          homeRedCards: event.homeRedCards ?? null,
          awayRedCards: event.awayRedCards ?? null,
        },
      });
    }
    return live;
  }

  private async recordSync(slug: string, error: string | null): Promise<void> {
    await prisma.apiProvider.updateMany({
      where: { slug },
      data: { lastSyncAt: new Date(), lastError: error },
    });
  }
}

export const sync = new SyncService();
