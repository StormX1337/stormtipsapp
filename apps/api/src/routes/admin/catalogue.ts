import type { FastifyInstance } from 'fastify';
import { prisma, type Prisma } from '@storm-tips/database';
import {
  adminEventsQuerySchema,
  AppError,
  createManualEventSchema,
  idParamSchema,
  paginationSchema,
  upsertBookmakerSchema,
  upsertLeagueSchema,
  upsertSportSchema,
  upsertTeamSchema,
} from '@storm-tips/types';
import { parseBody, parseParams, parseQuery } from '../../lib/validate.js';
import { paginate, skipTake } from '../../lib/http.js';
import { audit } from '../../lib/audit.js';
import { cacheInvalidatePattern } from '../../lib/cache.js';
import {
  eventInclude,
  leagueInclude,
  serializeAdminEvent,
  serializeLeague,
} from '../../serializers/catalogue.js';

export async function adminCatalogueRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireCapability('catalogue:write'));

  app.get('/sports', async () => ({
    items: await prisma.sport.findMany({ orderBy: { sortOrder: 'asc' } }),
  }));

  app.post('/sports', async (request, reply) => {
    const input = parseBody(request, upsertSportSchema);
    const sport = await prisma.sport.upsert({
      where: { key: input.key },
      create: input,
      update: input,
    });
    await cacheInvalidatePattern('catalogue:*');
    await audit(request, {
      action: 'sport.upserted',
      entityType: 'Sport',
      entityId: sport.id,
      after: input,
    });
    reply.status(201);
    return sport;
  });

  app.patch('/sports/:id', async (request) => {
    const { id } = parseParams(request, idParamSchema);
    const input = parseBody(request, upsertSportSchema.partial());
    const sport = await prisma.sport.update({ where: { id }, data: input });
    await cacheInvalidatePattern('catalogue:*');
    await audit(request, {
      action: 'sport.updated',
      entityType: 'Sport',
      entityId: id,
      after: input,
    });
    return sport;
  });

  app.get('/leagues', async (request) => {
    const query = parseQuery(request, paginationSchema);
    const { skip, take } = skipTake(query);
    const [leagues, total] = await Promise.all([
      prisma.league.findMany({
        include: leagueInclude,
        orderBy: [{ priority: 'asc' }, { name: 'asc' }],
        skip,
        take,
      }),
      prisma.league.count(),
    ]);
    return paginate(leagues.map(serializeLeague), total, query);
  });

  app.post('/leagues', async (request, reply) => {
    const input = parseBody(request, upsertLeagueSchema);
    const league = await prisma.league.upsert({
      where: { sportId_key: { sportId: input.sportId, key: input.key } },
      create: input as never,
      update: input as never,
      include: leagueInclude,
    });
    await cacheInvalidatePattern('catalogue:*');
    await audit(request, {
      action: 'league.upserted',
      entityType: 'League',
      entityId: league.id,
      after: input,
    });
    reply.status(201);
    return serializeLeague(league);
  });

  app.patch('/leagues/:id', async (request) => {
    const { id } = parseParams(request, idParamSchema);
    const input = parseBody(request, upsertLeagueSchema.partial());
    const league = await prisma.league.update({
      where: { id },
      data: input as never,
      include: leagueInclude,
    });
    await cacheInvalidatePattern('catalogue:*');
    await audit(request, {
      action: 'league.updated',
      entityType: 'League',
      entityId: id,
      after: input,
    });
    return serializeLeague(league);
  });

  app.get('/teams', async (request) => {
    const query = parseQuery(
      request,
      paginationSchema.extend(upsertTeamSchema.pick({ leagueId: true }).partial().shape),
    );
    const { skip, take } = skipTake(query);
    const where = query.leagueId ? { leagueId: query.leagueId } : {};
    const [teams, total] = await Promise.all([
      prisma.team.findMany({ where, orderBy: { name: 'asc' }, skip, take }),
      prisma.team.count({ where }),
    ]);
    return paginate(teams, total, query);
  });

  app.post('/teams', async (request, reply) => {
    const input = parseBody(request, upsertTeamSchema);
    const team = await prisma.team.upsert({
      where: { sportId_name: { sportId: input.sportId, name: input.name } },
      create: input as never,
      update: input as never,
    });
    await audit(request, {
      action: 'team.upserted',
      entityType: 'Team',
      entityId: team.id,
      after: input,
    });
    reply.status(201);
    return team;
  });

  app.patch('/teams/:id', async (request) => {
    const { id } = parseParams(request, idParamSchema);
    const input = parseBody(request, upsertTeamSchema.partial());
    const team = await prisma.team.update({ where: { id }, data: input as never });
    await audit(request, {
      action: 'team.updated',
      entityType: 'Team',
      entityId: id,
      after: input,
    });
    return team;
  });

  app.get('/bookmakers', async () => ({
    items: await prisma.bookmaker.findMany({ orderBy: { priority: 'asc' } }),
  }));

  app.post('/bookmakers', async (request, reply) => {
    const input = parseBody(request, upsertBookmakerSchema);
    const bookmaker = await prisma.bookmaker.upsert({
      where: { key: input.key },
      create: input as never,
      update: input as never,
    });
    await audit(request, {
      action: 'bookmaker.upserted',
      entityType: 'Bookmaker',
      entityId: bookmaker.id,
      after: input,
    });
    reply.status(201);
    return bookmaker;
  });

  app.patch('/bookmakers/:id', async (request) => {
    const { id } = parseParams(request, idParamSchema);
    const input = parseBody(request, upsertBookmakerSchema.partial());
    const bookmaker = await prisma.bookmaker.update({ where: { id }, data: input as never });
    await audit(request, {
      action: 'bookmaker.updated',
      entityType: 'Bookmaker',
      entityId: id,
      after: input,
    });
    return bookmaker;
  });

  app.get('/events', async (request) => {
    const query = parseQuery(request, adminEventsQuerySchema);
    const { skip, take } = skipTake(query);

    const where: Prisma.EventWhereInput = {
      ...(query.upcoming ? { startsAt: { gte: new Date() } } : {}),
      ...(query.search
        ? {
            OR: [
              { homeTeam: { name: { contains: query.search, mode: 'insensitive' } } },
              { awayTeam: { name: { contains: query.search, mode: 'insensitive' } } },
              { league: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: eventInclude,
        orderBy: { startsAt: query.order },
        skip,
        take,
      }),
      prisma.event.count({ where }),
    ]);
    return paginate(events.map(serializeAdminEvent), total, query);
  });

  /**
   * A fixture the provider does not carry, entered by hand.
   *
   * It is created without a provider id, which is what keeps it safe: the odds
   * and result syncs both select on `providerEventId: { not: null }`, so a
   * later sync can neither overwrite nor delete it. The other half of that
   * bargain is that nothing will settle it automatically — the operator enters
   * the score through the result correction below.
   */
  app.post('/events', async (request, reply) => {
    const input = parseBody(request, createManualEventSchema);

    const league = await prisma.league.findUnique({ where: { id: input.leagueId } });
    if (!league) throw AppError.notFound('League');

    /**
     * A name is matched against the league's sport before it creates anything —
     * typing "Arsenal" for a fixture the provider missed should reach the
     * Arsenal already in the catalogue, not add a second one beside it.
     */
    const resolveTeam = async (id: string | undefined, name: string | undefined) => {
      if (id) {
        const team = await prisma.team.findUnique({ where: { id } });
        if (!team) throw AppError.notFound('Team');
        if (team.sportId !== league.sportId) {
          throw AppError.validation('That team plays a different sport to the league');
        }
        return team;
      }
      const trimmed = name!.trim();
      return prisma.team.upsert({
        where: { sportId_name: { sportId: league.sportId, name: trimmed } },
        create: {
          sportId: league.sportId,
          leagueId: league.id,
          countryId: league.countryId,
          name: trimmed,
        },
        update: {},
      });
    };

    const home = await resolveTeam(input.homeTeamId, input.homeTeamName);
    const away = await resolveTeam(input.awayTeamId, input.awayTeamName);
    if (home.id === away.id) throw AppError.validation('A team cannot play itself');

    const startsAt = new Date(input.startsAt);

    /**
     * Two fixtures for the same pairing on the same day are a double submit far
     * more often than a genuine double-header, and a duplicate splits the tips
     * across two rows that then settle separately.
     */
    const dayStart = new Date(startsAt);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    const clash = await prisma.event.findFirst({
      where: {
        leagueId: league.id,
        homeTeamId: home.id,
        awayTeamId: away.id,
        startsAt: { gte: dayStart, lt: dayEnd },
      },
    });
    if (clash) {
      throw AppError.conflict('That fixture already exists on this date', { eventId: clash.id });
    }

    const event = await prisma.event.create({
      data: {
        leagueId: league.id,
        sportId: league.sportId,
        homeTeamId: home.id,
        awayTeamId: away.id,
        startsAt,
        venue: input.venue ?? null,
        round: input.round ?? null,
        season: input.season ?? league.season,
      },
      include: eventInclude,
    });

    await audit(request, {
      action: 'event.created_manually',
      entityType: 'Event',
      entityId: event.id,
      after: { ...input, homeTeamId: home.id, awayTeamId: away.id },
    });
    // A name that created a team puts a new row in the catalogue listings.
    await cacheInvalidatePattern('catalogue:*');
    reply.status(201);
    return serializeAdminEvent(event);
  });

  /** Manual score correction — triggers re-settlement of the affected tips. */
  app.patch('/events/:id/result', async (request) => {
    const { id } = parseParams(request, idParamSchema);
    const body = request.body as {
      homeScore?: number;
      awayScore?: number;
      htHomeScore?: number;
      htAwayScore?: number;
      status?: string;
    };
    const event = await prisma.event.update({
      where: { id },
      data: {
        homeScore: body.homeScore,
        awayScore: body.awayScore,
        htHomeScore: body.htHomeScore,
        htAwayScore: body.htAwayScore,
        status: (body.status ?? 'FINISHED') as never,
        resultSyncedAt: new Date(),
      },
      include: eventInclude,
    });
    await audit(request, {
      action: 'event.result_corrected',
      entityType: 'Event',
      entityId: id,
      after: body,
    });
    return serializeAdminEvent(event);
  });
}
