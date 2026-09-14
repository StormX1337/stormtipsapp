import type { FastifyInstance } from 'fastify';
import { pingDatabase } from '@storm-tips/database';
import { pingRedis } from '../lib/redis.js';
import { env } from '../lib/env.js';

const startedAt = Date.now();

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  /** Liveness: the process is up. Never touches a dependency. */
  app.get('/health', async () => ({
    status: 'ok',
    service: 'storm-tips-api',
    version: process.env.APP_VERSION ?? '1.0.0',
    env: env.NODE_ENV,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
  }));

  /** Readiness: every dependency the API needs to serve traffic. */
  app.get('/ready', async (_request, reply) => {
    const [database, redis] = await Promise.all([pingDatabase(), pingRedis()]);
    const ready = database && redis;
    reply.status(ready ? 200 : 503);
    return {
      status: ready ? 'ready' : 'degraded',
      checks: { database, redis },
    };
  });

  /** Prometheus-style metrics for process health. */
  app.get('/metrics', async (_request, reply) => {
    if (!env.METRICS_ENABLED) {
      reply.status(404);
      return { error: { code: 'NOT_FOUND', message: 'Metrics are disabled' } };
    }
    const memory = process.memoryUsage();
    const lines = [
      '# HELP storm_tips_uptime_seconds Process uptime in seconds',
      '# TYPE storm_tips_uptime_seconds gauge',
      `storm_tips_uptime_seconds ${Math.round((Date.now() - startedAt) / 1000)}`,
      '# HELP storm_tips_memory_bytes Resident memory in bytes',
      '# TYPE storm_tips_memory_bytes gauge',
      `storm_tips_memory_bytes{type="rss"} ${memory.rss}`,
      `storm_tips_memory_bytes{type="heap_used"} ${memory.heapUsed}`,
      `storm_tips_memory_bytes{type="heap_total"} ${memory.heapTotal}`,
    ];
    reply.header('content-type', 'text/plain; version=0.0.4');
    return `${lines.join('\n')}\n`;
  });
}
