import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@storm-tips/database';
import {
  authHeader,
  closeApp,
  createTestUser,
  deleteTestUser,
  getApp,
  grantProduct,
  login,
} from './helpers.js';

const createdUsers: string[] = [];

afterAll(async () => {
  for (const id of createdUsers) await deleteTestUser(id);
  await closeApp();
});

/** Finds a date on which the seed published at least one VIP tip. */
async function vipFeedDate(): Promise<string> {
  const tip = await prisma.tip.findFirst({
    where: { product: 'VIP', status: 'PUBLISHED' },
    include: { event: true },
    orderBy: { publishAt: 'desc' },
  });
  return (tip?.event.startsAt ?? new Date()).toISOString().slice(0, 10);
}

describe('premium gating', () => {
  it('returns VIP tips locked for an anonymous visitor', async () => {
    const app = await getApp();
    const date = await vipFeedDate();
    const response = await app.inject({ method: 'GET', url: `/api/v1/tips/vip?date=${date}` });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.totalTips).toBeGreaterThan(0);
    expect(body.lockedTips).toBe(body.totalTips);

    const tip = body.groups[0].tips[0];
    expect(tip.isLocked).toBe(true);
    // The pick must not leave the server at all.
    expect(tip.selectionLabel).toBeNull();
    expect(tip.odds).toBeNull();
    expect(tip.analysis).toBeNull();
    expect(tip.confidence).toBeNull();
    // Non-premium context is still returned so the paywall can show the fixture.
    expect(tip.event.homeTeam.name).toBeTruthy();
  });

  it('returns VIP tips locked for a user without the entitlement', async () => {
    const app = await getApp();
    const user = await createTestUser();
    createdUsers.push(user.id);
    const tokens = await login(app, user);
    const date = await vipFeedDate();

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/tips/vip?date=${date}`,
      headers: authHeader(tokens.accessToken),
    });
    const tip = response.json().groups[0]?.tips[0];
    expect(tip.isLocked).toBe(true);
    expect(tip.odds).toBeNull();
  });

  it('unlocks VIP tips once the entitlement is granted', async () => {
    const app = await getApp();
    const user = await createTestUser();
    createdUsers.push(user.id);
    await grantProduct(user.id, 'VIP');
    const tokens = await login(app, user);
    const date = await vipFeedDate();

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/tips/vip?date=${date}`,
      headers: authHeader(tokens.accessToken),
    });
    const body = response.json();
    expect(body.lockedTips).toBe(0);
    const tip = body.groups[0].tips[0];
    expect(tip.isLocked).toBe(false);
    expect(tip.selectionLabel).toBeTruthy();
    expect(typeof tip.odds).toBe('number');
  });

  it('does not leak one product into another', async () => {
    const app = await getApp();
    const user = await createTestUser();
    createdUsers.push(user.id);
    await grantProduct(user.id, 'VIP');
    const tokens = await login(app, user);

    const extra = await app.inject({
      method: 'GET',
      url: '/api/v1/tips/extra',
      headers: authHeader(tokens.accessToken),
    });
    const body = extra.json();
    if (body.totalTips > 0) {
      expect(body.lockedTips).toBe(body.totalTips);
    }
  });

  it('stops unlocking once the entitlement has expired', async () => {
    const app = await getApp();
    const user = await createTestUser();
    createdUsers.push(user.id);
    await prisma.entitlement.create({
      data: {
        userId: user.id,
        product: 'VIP',
        source: 'ADMIN_GRANT',
        grantedAt: new Date(Date.now() - 60 * 86_400_000),
        expiresAt: new Date(Date.now() - 86_400_000),
      },
    });
    const tokens = await login(app, user);
    const date = await vipFeedDate();

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/tips/vip?date=${date}`,
      headers: authHeader(tokens.accessToken),
    });
    expect(response.json().lockedTips).toBeGreaterThan(0);
  });

  it('never locks free tips', async () => {
    const app = await getApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/tips/free' });
    expect(response.json().lockedTips).toBe(0);
  });

  it('keeps settled history public', async () => {
    const app = await getApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/tips/history?product=VIP' });
    const body = response.json();
    expect(body.items.length).toBeGreaterThan(0);
    for (const tip of body.items) {
      expect(tip.isLocked).toBe(false);
      expect(tip.result).not.toBeNull();
    }
  });
});

describe('role guards', () => {
  it('rejects an ordinary user on the admin surface', async () => {
    const app = await getApp();
    const user = await createTestUser();
    createdUsers.push(user.id);
    const tokens = await login(app, user);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/dashboard',
      headers: authHeader(tokens.accessToken),
    });
    expect(response.statusCode).toBe(403);
  });

  it('rejects an anonymous caller on the admin surface', async () => {
    const app = await getApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/tips' });
    expect(response.statusCode).toBe(401);
  });

  it('allows a moderator to read tips but not to settle them', async () => {
    const app = await getApp();
    const moderator = await createTestUser({ role: 'MODERATOR' });
    createdUsers.push(moderator.id);
    const tokens = await login(app, moderator);

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/tips?limit=1',
      headers: authHeader(tokens.accessToken),
    });
    expect(list.statusCode).toBe(200);

    const tip = await prisma.tip.findFirstOrThrow({ where: { outcome: 'PENDING' } });
    const settle = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/tips/${tip.id}/settle`,
      headers: authHeader(tokens.accessToken),
      payload: { outcome: 'WON' },
    });
    expect(settle.statusCode).toBe(403);
  });

  it('lets an admin read the dashboard', async () => {
    const app = await getApp();
    const admin = await createTestUser({ role: 'ADMIN' });
    createdUsers.push(admin.id);
    const tokens = await login(app, admin);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/dashboard',
      headers: authHeader(tokens.accessToken),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().revenue.total.currency).toBe('EUR');
  });

  it('does not let an admin change roles (super admin only)', async () => {
    const app = await getApp();
    const admin = await createTestUser({ role: 'ADMIN' });
    const target = await createTestUser();
    createdUsers.push(admin.id, target.id);
    const tokens = await login(app, admin);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${target.id}`,
      headers: authHeader(tokens.accessToken),
      payload: { role: 'ADMIN' },
    });
    expect(response.statusCode).toBe(403);
  });
});
