import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { randomUUID } from 'node:crypto';
import { API_PREFIX } from '@profit-tips/config';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { securityPlugin } from './plugins/security.js';
import { authPlugin } from './plugins/auth.js';
import { errorHandlerPlugin } from './plugins/errors.js';
import { registerRoutes } from './routes/index.js';
import { registerWebSocketGateway } from './ws/gateway.js';

export async function buildServer() {
  const app = Fastify({
    loggerInstance: logger,
    trustProxy: true,
    bodyLimit: 1_048_576, // 1 MiB
    requestIdHeader: 'x-request-id',
    genReqId: (request) => (request.headers['x-request-id'] as string) ?? randomUUID(),
    ajv: { customOptions: { removeAdditional: 'all', coerceTypes: false } },
  });

  // Echo the request id so clients and logs can be correlated.
  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  /**
   * Stripe requires the byte-exact body to verify its signature, so the raw
   * payload is captured for webhook routes before JSON parsing replaces it.
   */
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (request, payload: Buffer, done) => {
      if (request.url.includes('/webhooks/')) {
        (request as { rawBody?: Buffer }).rawBody = payload;
      }
      if (payload.length === 0) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(payload.toString('utf8')));
      } catch (error) {
        done(error as Error, undefined);
      }
    },
  );

  await app.register(errorHandlerPlugin);
  await app.register(securityPlugin);
  await app.register(authPlugin);
  await app.register(websocket, {
    options: { maxPayload: 64 * 1024 },
  });

  await app.register(registerWebSocketGateway);
  await app.register(registerRoutes, { prefix: API_PREFIX });

  // Health probes live outside the versioned prefix so orchestrators can find them.
  const { healthRoutes } = await import('./routes/health.js');
  await app.register(healthRoutes);

  app.log.info(
    { prefix: API_PREFIX, env: env.NODE_ENV, provider: env.SPORTS_PROVIDER },
    'server built',
  );
  return app;
}
