import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

function createClient(role: string): Redis {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy: (attempt) => Math.min(attempt * 200, 5_000),
  });
  client.on('error', (error) => logger.error({ err: error, role }, 'redis error'));
  client.on('ready', () => logger.debug({ role }, 'redis ready'));
  return client;
}

/** Command connection — used for cache, rate limiting and queue producers. */
export const redis: Redis = createClient('commands');

/**
 * A Redis connection in subscriber mode cannot issue normal commands, so the
 * WebSocket fan-out uses its own connection.
 */
export const redisSubscriber: Redis = createClient('subscriber');
export const redisPublisher: Redis = createClient('publisher');

export async function pingRedis(): Promise<boolean> {
  try {
    return (await redis.ping()) === 'PONG';
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  await Promise.allSettled([redis.quit(), redisSubscriber.quit(), redisPublisher.quit()]);
}
