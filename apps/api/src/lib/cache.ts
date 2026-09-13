import { redis } from './redis.js';
import { logger } from './logger.js';

/**
 * Tiny JSON cache over Redis.
 *
 * Every failure is swallowed and logged: a cache outage must degrade latency,
 * never availability.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (error) {
    logger.warn({ err: error, key }, 'cache read failed');
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (error) {
    logger.warn({ err: error, key }, 'cache write failed');
  }
}

export async function cacheDelete(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch (error) {
    logger.warn({ err: error, keys }, 'cache delete failed');
  }
}

/** Deletes every key matching a glob, using SCAN so Redis is never blocked. */
export async function cacheInvalidatePattern(pattern: string): Promise<number> {
  let cursor = '0';
  let removed = 0;
  try {
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      cursor = next;
      if (keys.length > 0) {
        removed += await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (error) {
    logger.warn({ err: error, pattern }, 'cache invalidation failed');
  }
  return removed;
}

/** Read-through helper. */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  produce: () => Promise<T>,
): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;
  const value = await produce();
  await cacheSet(key, value, ttlSeconds);
  return value;
}
