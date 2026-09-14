import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@storm-tips/database';
import { authHeader, closeApp, createTestUser, deleteTestUser, getApp, login } from './helpers.js';
import { settlement } from '../src/services/settlement.service.js';

/**
 * The whole bargain of a manual fixture is that no sync touches it. This proves
 * the other half still works: a score entered by hand settles the tips on it,
 * because the due-settlement job selects on the event's status rather than on
 * anything the provider supplied.
 */
const created = { eventId: '', tipId: '', teamIds: [] as string[], userIds: [] as string[] };
const suffix = randomUUID().slice(0, 8);

afterAll(async () => {
  await prisma.tip.deleteMany({ where: { id: created.tipId } });
  await prisma.event.deleteMany({ where: { id: created.eventId } });
  await prisma.team.deleteMany({ where: { id: { in: created.teamIds } } });
  for (const id of created.userIds) await deleteTestUser(id);
  await closeApp();
});

describe('settling a manual fixture', () => {
  it('settles a tip from a score typed into the admin', async () => {
    const app = await getApp();
    const admin = await createTestUser({ role: 'SUPER_ADMIN' });
    created.userIds.push(admin.id);
    const token = (await login(app, admin)).accessToken;

    const league = await prisma.league.findFirstOrThrow();

    const fixture = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/catalogue/events',
      headers: authHeader(token),
      payload: {
        leagueId: league.id,
        homeTeamName: `Settle Home ${suffix}`,
        awayTeamName: `Settle Away ${suffix}`,
        startsAt: '2030-07-01T18:00:00.000Z',
      },
    });
    expect(fixture.statusCode).toBe(201);
    const event = fixture.json();
    created.eventId = event.id;
    created.teamIds.push(event.homeTeam.id, event.awayTeam.id);

    // A published tip on the home side, written through the admin route the
    // operator would use: 2–0 makes it a winner.
    const published = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/tips',
      headers: authHeader(token),
      payload: {
        eventId: event.id,
        marketType: 'MATCH_WINNER',
        selectionKey: 'HOME',
        selectionLabel: 'Home win',
        odds: 1.8,
        product: 'FREE',
        status: 'PUBLISHED',
      },
    });
    expect(published.statusCode).toBe(201);
    created.tipId = published.json().id;

    const correction = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/catalogue/events/${event.id}/result`,
      headers: authHeader(token),
      payload: { homeScore: 2, awayScore: 0, status: 'FINISHED' },
    });
    expect(correction.statusCode).toBe(200);

    await settlement.settleDueTips();

    const settled = await prisma.tip.findUniqueOrThrow({ where: { id: created.tipId } });
    expect(settled.outcome).toBe('WON');
    expect(settled.settledAt).not.toBeNull();
  });
});
