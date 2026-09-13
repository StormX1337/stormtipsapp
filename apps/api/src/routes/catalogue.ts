import type { FastifyInstance } from 'fastify';
import { prisma } from '@profit-tips/database';
import { CACHE_TTL } from '@profit-tips/config';
import { eventsQuerySchema, idParamSchema, oddsQuerySchema } from '@profit-tips/types';
import { parseParams, parseQuery } from '../lib/validate.js';
import { assertFound, paginate, publicCache, skipTake } from '../lib/http.js';
import { cached } from '../lib/cache.js';
import {
  eventInclude,
  leagueInclude,
  oddInclude,
  serializeCountry,
  serializeEvent,
  serializeLeague,
  serializeOdd,
  serializeSport,
  serializeTeam,
} from '../serializers/catalogue.js';

export async function catalogueRoutes(app: FastifyInstance): Promise<void> {
  app.get('/sports', async (_request, reply) => {
    publicCache(reply, CACHE_TTL.leagues);
    const sports = await cached('catalogue:sports', CACHE_TTL.leagues, async () =>
      (await prisma.sport.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } })).map(
        serializeSport,
      ),
    );
    return { items: sports };
  });

  app.get('/countries', async (_request, reply) => {
    publicCache(reply, CACHE_TTL.leagues);
    const countries = await cached('catalogue:countries', CACHE_TTL.leagues, async () =>
      (await prisma.country.findMany({ orderBy: { name: 'asc' } })).map(serializeCountry),
    );
    return { items: countries };
  });

  app.get('/leagues', async (request, reply) => {
    const query = parseQuery(
      request,
      eventsQuerySchema.pick({ sportId: true, page: true, limit: true }),
    );
    publicCache(reply, CACHE_TTL.leagues);
    const leagues = await prisma.league.findMany({
      where: { isActive: true, ...(query.sportId ? { sportId: query.sportId } : {}) },
      include: leagueInclude,
      orderBy: [{ priority: 'asc' }, { name: 'asc' }],
    });
    return { items: leagues.map(serializeLeague) };
  });

  app.get('/leagues/:id', async (request) => {
    const { id } = parseParams(request, idParamSchema);
    const league = assertFound(
      await prisma.league.findUnique({ where: { id }, include: leagueInclude }),
      'League',
    );
    return serializeLeague(league);
  });

  app.get('/leagues/:id/teams', async (request) => {
    const { id } = parseParams(request, idParamSchema);
    const teams = await prisma.team.findMany({
      where: { leagueId: id },
      orderBy: { name: 'asc' },
    });
    return { items: teams.map(serializeTeam) };
  });

  app.get('/events', async (request, reply) => {
    const query = parseQuery(request, eventsQuerySchema);
    const { skip, take } = skipTake(query);

    const where = {
      ...(query.sportId ? { sportId: query.sportId } : {}),
      ...(query.leagueId ? { leagueId: query.leagueId } : {}),
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.live ? { status: { in: ['LIVE', 'HALFTIME'] as never } } : {}),
      ...(query.date
        ? {
            startsAt: {
              gte: new Date(`${query.date}T00:00:00.000Z`),
              lt: new Date(`${query.date}T23:59:59.999Z`),
            },
          }
        : {}),
      ...(query.from || query.to
        ? {
            startsAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: eventInclude,
        orderBy: { startsAt: 'asc' },
        skip,
        take,
      }),
      prisma.event.count({ where }),
    ]);

    publicCache(reply, query.live ? CACHE_TTL.liveEvents : 30);
    return paginate(events.map(serializeEvent), total, query);
  });

  app.get('/events/live', async (_request, reply) => {
    const events = await prisma.event.findMany({
      where: { status: { in: ['LIVE', 'HALFTIME'] } },
      include: eventInclude,
      orderBy: { startsAt: 'asc' },
      take: 100,
    });
    publicCache(reply, CACHE_TTL.liveEvents);
    return { items: events.map(serializeEvent) };
  });

  app.get('/events/:id', async (request) => {
    const { id } = parseParams(request, idParamSchema);
    const event = assertFound(
      await prisma.event.findUnique({ where: { id }, include: eventInclude }),
      'Event',
    );
    return serializeEvent(event);
  });

  app.get('/odds', async (request, reply) => {
    const query = parseQuery(request, oddsQuerySchema);
    const odds = await prisma.odd.findMany({
      where: {
        eventId: query.eventId,
        ...(query.bookmakerId ? { bookmakerId: query.bookmakerId } : {}),
        ...(query.marketType ? { market: { type: query.marketType as never } } : {}),
      },
      include: oddInclude,
      orderBy: [{ market: { sortOrder: 'asc' } }, { selection: 'asc' }],
      take: 400,
    });
    publicCache(reply, 15);
    return { items: odds.map(serializeOdd) };
  });

  /** Opening → current price history for one selection. */
  app.get('/odds/:id/history', async (request) => {
    const { id } = parseParams(request, idParamSchema);
    const history = await prisma.oddsHistory.findMany({
      where: { oddId: id },
      orderBy: { recordedAt: 'asc' },
      take: 500,
    });
    return {
      items: history.map((point) => ({
        price: Number(point.price),
        delta: Number(point.delta),
        recordedAt: point.recordedAt.toISOString(),
      })),
    };
  });

  app.get('/bookmakers', async (_request, reply) => {
    publicCache(reply, CACHE_TTL.leagues);
    const bookmakers = await prisma.bookmaker.findMany({
      where: { isActive: true },
      orderBy: { priority: 'asc' },
    });
    return {
      items: bookmakers.map((bookmaker) => ({
        id: bookmaker.id,
        key: bookmaker.key,
        name: bookmaker.name,
        logoUrl: bookmaker.logoUrl,
        color: bookmaker.color,
        website: bookmaker.website,
      })),
    };
  });
}
