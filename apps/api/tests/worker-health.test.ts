import { afterAll, describe, expect, it } from 'vitest';
import { REDIS_KEYS } from '@storm-tips/config';
import { authHeader, closeApp, createTestUser, deleteTestUser, getApp, login } from './helpers.js';
import { redis } from '../src/lib/redis.js';

/**
 * The console's only way to say "nothing is processing the queues".
 *
 * The verdict must come from the heartbeat rather than from BullMQ's worker
 * registration, because that registration is a live Redis connection and can
 * outlive the process that opened it — which would report a crashed worker as
 * healthy, the one case the banner exists for.
 */
const createdUsers: string[] = [];
const key = REDIS_KEYS.workerHeartbeat();

afterAll(async () => {
  await redis.del(key);
  for (const id of createdUsers) await deleteTestUser(id);
  await closeApp();
});

async function read(token: string) {
  const app = await getApp();
  return app.inject({
    method: 'GET',
    url: '/api/v1/admin/ops/workers',
    headers: authHeader(token),
  });
}

describe('worker health', () => {
  it('reports no worker when the heartbeat has expired', async () => {
    const app = await getApp();
    const admin = await createTestUser({ role: 'ADMIN' });
    createdUsers.push(admin.id);
    const token = (await login(app, admin)).accessToken;

    await redis.del(key);
    const response = await read(token);
    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.connected).toBe(false);
    expect(body.lastBeatAt).toBeNull();
    // The queue detail is still reported, so the banner can say what is waiting.
    expect(body.queues.length).toBeGreaterThan(0);
    expect(body.queues[0]).toHaveProperty('waiting');
  });

  it('reports a worker while the heartbeat is fresh', async () => {
    const app = await getApp();
    const admin = await createTestUser({ role: 'ADMIN' });
    createdUsers.push(admin.id);
    const token = (await login(app, admin)).accessToken;

    const at = new Date().toISOString();
    await redis.set(key, JSON.stringify({ pid: 1, at, queues: 8 }), 'EX', 60);

    const body = (await read(token)).json();
    expect(body.connected).toBe(true);
    expect(body.lastBeatAt).toBe(at);
  });

  it('still reports a worker when the heartbeat value is unreadable', async () => {
    const app = await getApp();
    const admin = await createTestUser({ role: 'ADMIN' });
    createdUsers.push(admin.id);
    const token = (await login(app, admin)).accessToken;

    // Something wrote the key within the TTL, which is the fact that matters.
    await redis.set(key, 'not json', 'EX', 60);

    const body = (await read(token)).json();
    expect(body.connected).toBe(true);
    expect(body.lastBeatAt).toBeNull();
  });

  it('is closed to a moderator', async () => {
    const app = await getApp();
    const moderator = await createTestUser({ role: 'MODERATOR' });
    createdUsers.push(moderator.id);
    const token = (await login(app, moderator)).accessToken;

    expect((await read(token)).statusCode).toBe(403);
  });
});
