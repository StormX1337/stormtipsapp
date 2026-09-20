import type { FastifyInstance } from 'fastify';
import { API_VERSION, APP_NAME } from '@storm-tips/config';
import { authRoutes } from './auth.js';
import { meRoutes } from './me.js';
import { catalogueRoutes } from './catalogue.js';
import { tipRoutes } from './tips.js';
import { statisticsRoutes } from './statistics.js';
import { billingRoutes } from './billing.js';
import { pollRoutes } from './polls.js';
import { analyticsRoutes } from './analytics.js';
import { webhookRoutes } from './webhooks/index.js';
import { adminRoutes } from './admin/index.js';
import { openApiDocument } from '../lib/openapi.js';
import { env } from '../lib/env.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => ({
    name: APP_NAME,
    version: API_VERSION,
    documentation: '/api/v1/openapi.json',
    endpoints: [
      '/auth',
      '/me',
      '/sports',
      '/leagues',
      '/events',
      '/odds',
      '/tips',
      '/statistics',
      '/billing',
      '/polls',
      '/analytics',
      '/webhooks',
      '/admin',
    ],
  }));

  app.get('/openapi.json', async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=300');
    return openApiDocument();
  });

  /**
   * What a browser needs before it can subscribe to push.
   *
   * The VAPID *public* key is meant to be public — it is what the browser
   * encrypts to, and it is useless without the private half, which never
   * leaves the server. `enabled` is false when no pair is configured, so the
   * web app can hide the toggle rather than offer something that cannot work.
   */
  app.get('/push/config', async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=300');
    return {
      enabled: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
      publicKey: env.VAPID_PUBLIC_KEY ?? null,
    };
  });

  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(meRoutes, { prefix: '/me' });
  await app.register(catalogueRoutes);
  await app.register(tipRoutes, { prefix: '/tips' });
  await app.register(statisticsRoutes, { prefix: '/statistics' });
  await app.register(billingRoutes, { prefix: '/billing' });
  await app.register(pollRoutes, { prefix: '/polls' });
  await app.register(analyticsRoutes, { prefix: '/analytics' });
  await app.register(webhookRoutes, { prefix: '/webhooks' });
  await app.register(adminRoutes, { prefix: '/admin' });
}
