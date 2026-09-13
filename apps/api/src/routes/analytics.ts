import type { FastifyInstance } from 'fastify';
import { trackBatchSchema, trackEventSchema } from '@profit-tips/types';
import { parseBody } from '../lib/validate.js';
import { noStore } from '../lib/http.js';
import { analytics } from '../services/analytics.service.js';

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.optionalAuth);

  app.post(
    '/events',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const input = parseBody(request, trackEventSchema);
      await analytics.track([{ ...input, userId: request.auth?.userId ?? null }]);
      noStore(reply).status(202);
      return { accepted: 1 };
    },
  );

  app.post(
    '/batch',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { events } = parseBody(request, trackBatchSchema);
      const accepted = await analytics.track(
        events.map((event) => ({ ...event, userId: request.auth?.userId ?? null })),
      );
      noStore(reply).status(202);
      return { accepted };
    },
  );
}
