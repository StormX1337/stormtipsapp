import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@storm-tips/database';
import { authHeader, closeApp, createTestUser, deleteTestUser, getApp, login } from './helpers.js';

/**
 * A fixture the data provider does not carry, entered through the admin.
 *
 * The point of the feature is that the provider can never reach it: the odds
 * and result syncs both select on a non-null `providerEventId`, so these rows
 * are invisible to them — which is also why nothing settles them automatically.
 */
const createdEvents: string[] = [];
const createdTeams: string[] = [];
const createdUsers: string[] = [];

let leagueId = '';
let sportId = '';
let token = '';
let userToken = '';

/** Unique per run so repeated runs never collide on the (sport, name) key. */
const suffix = randomUUID().slice(0, 8);
const home = `Home ${suffix}`;
const away = `Away ${suffix}`;

beforeAll(async () => {
  const app = await getApp();

  const admin = await createTestUser({ role: 'SUPER_ADMIN' });
  createdUsers.push(admin.id);
  token = (await login(app, admin)).accessToken;

  const plain = await createTestUser();
  createdUsers.push(plain.id);
  userToken = (await login(app, plain)).accessToken;

  const league = await prisma.league.findFirstOrThrow();
  leagueId = league.id;
  sportId = league.sportId;
});

afterAll(async () => {
  await prisma.event.deleteMany({ where: { id: { in: createdEvents } } });
  await prisma.team.deleteMany({ where: { id: { in: createdTeams } } });
  await prisma.team.deleteMany({ where: { sportId, name: { in: [home, away] } } });
  for (const id of createdUsers) await deleteTestUser(id);
  await closeApp();
});

async function createFixture(payload: Record<string, unknown>, asToken = token) {
  const app = await getApp();
  return app.inject({
    method: 'POST',
    url: '/api/v1/admin/catalogue/events',
    headers: authHeader(asToken),
    payload,
  });
}

describe('manual fixtures', () => {
  it('creates a fixture from two team names', async () => {
    const response = await createFixture({
      leagueId,
      homeTeamName: home,
      awayTeamName: away,
      startsAt: '2030-05-01T18:00:00.000Z',
      venue: 'Test Ground',
    });
    expect(response.statusCode).toBe(201);

    const body = response.json();
    createdEvents.push(body.id);
    expect(body.homeTeam.name).toBe(home);
    expect(body.awayTeam.name).toBe(away);
    expect(body.venue).toBe('Test Ground');
    expect(body.isManual).toBe(true);

    const row = await prisma.event.findUniqueOrThrow({ where: { id: body.id } });
    expect(row.providerEventId).toBeNull();
    expect(row.providerSlug).toBeNull();
  });

  it('matches a name to the team it already created rather than adding a second', async () => {
    const response = await createFixture({
      leagueId,
      homeTeamName: home,
      awayTeamName: away,
      // A different day, so the duplicate guard below does not fire.
      startsAt: '2030-05-08T18:00:00.000Z',
    });
    expect(response.statusCode).toBe(201);
    createdEvents.push(response.json().id);

    expect(await prisma.team.count({ where: { sportId, name: home } })).toBe(1);
  });

  it('refuses a second fixture for the same pairing on the same day', async () => {
    const response = await createFixture({
      leagueId,
      homeTeamName: home,
      awayTeamName: away,
      // Same calendar day as the first fixture, a few hours later.
      startsAt: '2030-05-01T20:45:00.000Z',
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.details.eventId).toBe(createdEvents[0]);
  });

  it('refuses a team playing itself', async () => {
    const response = await createFixture({
      leagueId,
      homeTeamName: home,
      awayTeamName: home.toUpperCase(),
      startsAt: '2030-06-01T18:00:00.000Z',
    });
    expect(response.statusCode).toBe(422);
  });

  it('refuses a side given as both an id and a name', async () => {
    const team = await prisma.team.findFirstOrThrow({ where: { sportId } });
    const response = await createFixture({
      leagueId,
      homeTeamId: team.id,
      homeTeamName: home,
      awayTeamName: away,
      startsAt: '2030-06-02T18:00:00.000Z',
    });
    expect(response.statusCode).toBe(422);
  });

  it('refuses a team that plays a different sport to the league', async () => {
    const other = await prisma.team.findFirst({ where: { sportId: { not: sportId } } });
    if (!other) return; // single-sport catalogue: nothing to assert
    const response = await createFixture({
      leagueId,
      homeTeamId: other.id,
      awayTeamName: away,
      startsAt: '2030-06-03T18:00:00.000Z',
    });
    expect(response.statusCode).toBe(422);
  });

  it('refuses an unknown league', async () => {
    const response = await createFixture({
      leagueId: 'clzzzzzzzzzzzzzzzzzzzzzzz',
      homeTeamName: home,
      awayTeamName: away,
      startsAt: '2030-06-04T18:00:00.000Z',
    });
    expect(response.statusCode).toBe(404);
  });

  it('is closed to a user without the catalogue capability', async () => {
    const response = await createFixture(
      {
        leagueId,
        homeTeamName: `Trespass ${suffix}`,
        awayTeamName: away,
        startsAt: '2030-06-05T18:00:00.000Z',
      },
      userToken,
    );
    expect(response.statusCode).toBe(403);
    expect(await prisma.team.count({ where: { sportId, name: `Trespass ${suffix}` } })).toBe(0);
  });
});
