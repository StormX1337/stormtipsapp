import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@storm-tips/database';
import { notifications } from '../src/services/notification.service.js';
import { closeApp, createTestUser, deleteTestUser, type TestUser } from './helpers.js';

/**
 * "Only my favourites" narrows what is worth interrupting someone for. It must
 * never narrow it to nothing, and it must never affect a reader who did not
 * ask for it.
 */
describe('favourite leagues and teams', () => {
  let plain: TestUser;
  let picky: TestUser;
  let leagueId: string;
  let otherLeagueId: string;
  let teamId: string;

  beforeAll(async () => {
    plain = await createTestUser();
    picky = await createTestUser();

    const leagues = await prisma.league.findMany({ select: { id: true }, take: 2 });
    leagueId = leagues[0]!.id;
    otherLeagueId = leagues[1]!.id;
    teamId = (await prisma.team.findFirstOrThrow({ select: { id: true } })).id;

    await prisma.user.update({
      where: { id: picky.id },
      data: {
        favoriteLeagueIds: [leagueId],
        favoriteTeamIds: [teamId],
        notificationPrefs: { onlyFavourites: true },
      },
    });
  });

  afterAll(async () => {
    await deleteTestUser(plain.id);
    await deleteTestUser(picky.id);
    await closeApp();
  });

  async function audience(about?: { leagueId?: string; teamIds?: string[] }): Promise<string[]> {
    const users = await notifications.resolveAudience('NEW_TIP', {
      userIds: [plain.id, picky.id],
      ...(about ? { about } : {}),
    });
    return users.map((user) => user.id).sort();
  }

  it('leaves a reader who did not ask for it alone', async () => {
    expect(await audience({ leagueId: otherLeagueId })).toContain(plain.id);
  });

  it('drops the picky reader from a league they did not mark', async () => {
    const ids = await audience({ leagueId: otherLeagueId, teamIds: [] });
    expect(ids).not.toContain(picky.id);
  });

  it('keeps them for a league they marked', async () => {
    const ids = await audience({ leagueId, teamIds: [] });
    expect(ids).toContain(picky.id);
  });

  it('keeps them for a team they marked in a league they did not', async () => {
    const ids = await audience({ leagueId: otherLeagueId, teamIds: [teamId] });
    expect(ids).toContain(picky.id);
  });

  it('never filters a notification that is not about a match', async () => {
    // Subscription reminders and promotions carry no `about`, so nobody is
    // dropped — otherwise the setting would silence their own account.
    expect(await audience()).toContain(picky.id);
  });

  it('is inert until something is actually marked', async () => {
    await prisma.user.update({
      where: { id: picky.id },
      data: { favoriteLeagueIds: [], favoriteTeamIds: [] },
    });
    const ids = await audience({ leagueId: otherLeagueId, teamIds: [] });
    expect(ids).toContain(picky.id);
  });
});
