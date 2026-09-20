import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@storm-tips/database';
import {
  authHeader,
  closeApp,
  createTestUser,
  deleteTestUser,
  getApp,
  login,
  type TestUser,
} from './helpers.js';

/**
 * The reader's own record.
 *
 * The point of these is that the record is *theirs*: computed from the tips
 * they tracked and the stake they entered, never from the published flat stake
 * or from tips they skipped.
 */
describe('my record', () => {
  let app: FastifyInstance;
  let user: TestUser;
  let token: string;
  let wonTipId: string;
  let lostTipId: string;

  beforeAll(async () => {
    app = await getApp();
    user = await createTestUser();
    token = (await login(app, user)).accessToken;

    const settled = await prisma.tip.findMany({
      where: { status: 'PUBLISHED', outcome: 'WON', settledAt: { not: null } },
      select: { id: true },
      take: 1,
    });
    const lost = await prisma.tip.findMany({
      where: { status: 'PUBLISHED', outcome: 'LOST', settledAt: { not: null } },
      select: { id: true },
      take: 1,
    });
    wonTipId = settled[0]!.id;
    lostTipId = lost[0]!.id;
  });

  afterAll(async () => {
    await deleteTestUser(user.id);
    await closeApp();
  });

  it('starts empty', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/me/record?window=ALL',
      headers: authHeader(token),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().settledTips).toBe(0);
  });

  it('counts a tracked tip with the reader’s own stake', async () => {
    await app.inject({
      method: 'PUT',
      url: `/api/v1/me/follows/${wonTipId}`,
      headers: authHeader(token),
      payload: { stake: 25 },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/me/record?window=ALL',
      headers: authHeader(token),
    });
    const record = response.json();
    expect(record.settledTips).toBe(1);
    expect(record.won).toBe(1);
    // The stake is the reader's 25, not the published flat stake.
    expect(record.totalStake).toBe(25);
    expect(record.profit).toBeGreaterThan(0);
  });

  it('ignores tips the reader did not track', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/me/record?window=ALL',
      headers: authHeader(token),
    });
    // The seed has hundreds of settled tips; only the one tracked above counts.
    expect(response.json().settledTips).toBe(1);
  });

  it('a second follow updates the stake rather than duplicating the tip', async () => {
    await app.inject({
      method: 'PUT',
      url: `/api/v1/me/follows/${wonTipId}`,
      headers: authHeader(token),
      payload: { stake: 5 },
    });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/me/record?window=ALL',
      headers: authHeader(token),
    });
    expect(response.json().settledTips).toBe(1);
    expect(response.json().totalStake).toBe(5);
  });

  it('a loss lowers the record', async () => {
    await app.inject({
      method: 'PUT',
      url: `/api/v1/me/follows/${lostTipId}`,
      headers: authHeader(token),
      payload: { stake: 10 },
    });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/me/record?window=ALL',
      headers: authHeader(token),
    });
    const record = response.json();
    expect(record.settledTips).toBe(2);
    expect(record.lost).toBe(1);
  });

  it('untracking removes the tip from the record', async () => {
    await app.inject({
      method: 'DELETE',
      url: `/api/v1/me/follows/${lostTipId}`,
      headers: authHeader(token),
    });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/me/record?window=ALL',
      headers: authHeader(token),
    });
    expect(response.json().settledTips).toBe(1);

    const ids = await app.inject({
      method: 'GET',
      url: '/api/v1/me/follows',
      headers: authHeader(token),
    });
    expect(ids.json().items).toEqual([wonTipId]);
  });

  it('is private to the reader', async () => {
    const other = await createTestUser();
    const otherToken = (await login(app, other)).accessToken;
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/me/record?window=ALL',
      headers: authHeader(otherToken),
    });
    expect(response.json().settledTips).toBe(0);
    await deleteTestUser(other.id);
  });

  it('refuses an anonymous caller', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/me/record' });
    expect(response.statusCode).toBe(401);
  });
});
