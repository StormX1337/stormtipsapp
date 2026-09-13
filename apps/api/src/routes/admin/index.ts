import type { FastifyInstance } from 'fastify';
import { adminTipRoutes } from './tips.js';
import { adminUserRoutes } from './users.js';
import { adminCommerceRoutes } from './commerce.js';
import { adminCatalogueRoutes } from './catalogue.js';
import { adminDashboardRoutes } from './dashboard.js';
import { adminOpsRoutes } from './ops.js';

/**
 * Admin surface.
 *
 * Every route below is behind `MODERATOR` at minimum; individual handlers
 * tighten that further through `requireCapability`.
 */
export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireRole('MODERATOR'));
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('cache-control', 'no-store, private');
    return payload;
  });

  await app.register(adminDashboardRoutes, { prefix: '/dashboard' });
  await app.register(adminTipRoutes, { prefix: '/tips' });
  await app.register(adminUserRoutes, { prefix: '/users' });
  await app.register(adminCommerceRoutes, { prefix: '/commerce' });
  await app.register(adminCatalogueRoutes, { prefix: '/catalogue' });
  await app.register(adminOpsRoutes, { prefix: '/ops' });
}
