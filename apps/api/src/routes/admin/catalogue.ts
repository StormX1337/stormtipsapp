import type { FastifyInstance } from 'fastify';
import { prisma } from '@profit-tips/database';
import {
  idParamSchema,
  paginationSchema,
  upsertBookmakerSchema,
  upsertLeagueSchema,
  upsertSportSchema,
  upsertTeamSchema,
} from '@profit-tips/types';
import { parseBody, parseParams, parseQuery } from '../../lib/validate.js';
import { paginate, skipTake } from '../../lib/http.js';
import { audit } from '../../lib/audit.js';
import { cacheInvalidatePattern } from '../../lib/cache.js';
import { eventInclude, leagueInclude, serializeEvent, serializeLeague } from '../../serializers/catalogue.js';

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
    await audit(request, { action: 'sport.upserted', entityType: 'Sport', entityId: sport.id, after: input });
    reply.status(201);
    return sport;
  });

  app.patch('/sports/:id', async (request) => {
    const { id } = parseParams(request, idParamSchema);
    const input = parseBody(request, upsertSportSchema.partial());
    const sport = await prisma.sport.update({ where: { id }, data: input });
    await cacheInvalidatePattern('catalogue:*');
    await audit(request, { action: 'sport.updated', entityType: 'Sport', entityId: id, after: input });
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
    await audit(request, { action: 'league.upserted', entityType: 'League', entityId: league.id, after: input });
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
    await audit(request, { action: 'league.updated', entityType: 'League', entityId: id, after: input });
    return serializeLeague(league);
  });

  app.get('/teams', async (request) => {
    const query = parseQuery(request, paginationSchema.extend(upsertTeamSchema.pick({ leagueId: true }).partial().shape));
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
    await audit(request, { action: 'team.upserted', entityType: 'Team', entityId: team.id, after: input });
    reply.status(201);
    return team;
  });

  app.patch('/teams/:id', async (request) => {
    const { id } = parseParams(request, idParamSchema);
    const input = parseBody(request, upsertTeamSchema.partial());
    const team = await prisma.team.update({ where: { id }, data: input as never });
    await audit(request, { action: 'team.updated', entityType: 'Team', entityId: id, after: input });
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
    await audit(request, { action: 'bookmaker.updated', entityType: 'Bookmaker', entityId: id, after: input });
    return bookmaker;
  });

  app.get('/events', async (request) => {
    const query = parseQuery(request, paginationSchema);
    const { skip, take } = skipTake(query);
    const [events, total] = await Promise.all([
      prisma.event.findMany({
        include: eventInclude,
        orderBy: { startsAt: 'desc' },
        skip,
        take,
      }),
      prisma.event.count(),
    ]);
    return paginate(events.map(serializeEvent), total, query);
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
    await audit(request, { action: 'event.result_corrected', entityType: 'Event', entityId: id, after: body });
    return serializeEvent(event);
  });
}
