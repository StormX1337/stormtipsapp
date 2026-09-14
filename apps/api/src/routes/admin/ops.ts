import type { FastifyInstance } from 'fastify';
import { prisma } from '@storm-tips/database';
import { encryptSecret, maskSecret } from '@storm-tips/auth';
import { AVAILABLE_PROVIDERS } from '@storm-tips/sports';
import {
  idParamSchema,
  paginationSchema,
  referralProgramSchema,
  sendNotificationSchema,
  updateSettingsSchema,
  upsertApiProviderSchema,
  upsertPollSchema,
} from '@storm-tips/types';
import { parseBody, parseParams, parseQuery } from '../../lib/validate.js';
import { assertFound, paginate, skipTake } from '../../lib/http.js';
import { audit } from '../../lib/audit.js';
import { env } from '../../lib/env.js';
import { jobs } from '../../lib/queues.js';
import { pollInclude, serializePoll } from '../../serializers/poll.js';
import { notifications } from '../../services/notification.service.js';
import { referrals } from '../../services/referral.service.js';
import { sync } from '../../services/sync.service.js';
import { statistics } from '../../services/statistics.service.js';

export async function adminOpsRoutes(app: FastifyInstance): Promise<void> {
  // ── polls ─────────────────────────────────────────────────────────────────
  app.get('/polls', { preHandler: [app.requireCapability('polls:write')] }, async (request) => {
    const query = parseQuery(request, paginationSchema);
    const { skip, take } = skipTake(query);
    const [polls, total] = await Promise.all([
      prisma.poll.findMany({ include: pollInclude, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.poll.count(),
    ]);
    return paginate(
      polls.map((poll) => serializePoll(poll)),
      total,
      query,
    );
  });

  app.post(
    '/polls',
    { preHandler: [app.requireCapability('polls:write')] },
    async (request, reply) => {
      const input = parseBody(request, upsertPollSchema);
      const poll = await prisma.poll.create({
        data: {
          question: input.question,
          description: input.description ?? null,
          kind: input.kind,
          status: input.status,
          product: input.product ?? null,
          eventId: input.eventId ?? null,
          imageUrl: input.imageUrl ?? null,
          allowMultiple: input.allowMultiple,
          showResultsBeforeVote: input.showResultsBeforeVote,
          startsAt: input.startsAt ? new Date(input.startsAt) : new Date(),
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
          createdById: request.auth!.userId,
          options: {
            create: input.options.map((option, index) => ({
              label: option.label,
              imageUrl: option.imageUrl ?? null,
              sortOrder: index,
            })),
          },
        },
        include: pollInclude,
      });
      await audit(request, {
        action: 'poll.created',
        entityType: 'Poll',
        entityId: poll.id,
        after: input,
      });
      reply.status(201);
      return serializePoll(poll);
    },
  );

  app.patch(
    '/polls/:id',
    { preHandler: [app.requireCapability('polls:write')] },
    async (request) => {
      const { id } = parseParams(request, idParamSchema);
      const input = parseBody(request, upsertPollSchema.partial());
      const before = assertFound(await prisma.poll.findUnique({ where: { id } }), 'Poll');
      const poll = await prisma.poll.update({
        where: { id },
        data: {
          question: input.question,
          description: input.description,
          kind: input.kind,
          status: input.status,
          imageUrl: input.imageUrl,
          allowMultiple: input.allowMultiple,
          showResultsBeforeVote: input.showResultsBeforeVote,
          startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
          endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
        },
        include: pollInclude,
      });
      await audit(request, {
        action: 'poll.updated',
        entityType: 'Poll',
        entityId: id,
        before,
        after: input,
      });
      return serializePoll(poll);
    },
  );

  app.delete(
    '/polls/:id',
    { preHandler: [app.requireCapability('polls:write')] },
    async (request) => {
      const { id } = parseParams(request, idParamSchema);
      await prisma.poll.delete({ where: { id } });
      await audit(request, { action: 'poll.deleted', entityType: 'Poll', entityId: id });
      return { success: true };
    },
  );

  // ── notifications ─────────────────────────────────────────────────────────
  app.post(
    '/notifications/send',
    { preHandler: [app.requireCapability('notifications:send')] },
    async (request, reply) => {
      const input = parseBody(request, sendNotificationSchema);
      const recipients = await notifications.resolveAudience(input.type, input.audience as never);

      await notifications.broadcast({
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data,
        deepLink: input.deepLink ?? null,
        imageUrl: input.imageUrl ?? null,
        audience: input.audience as never,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        dedupeKey: `admin:${request.id}`,
      });

      await audit(request, {
        action: 'notification.queued',
        entityType: 'Notification',
        after: { title: input.title, recipients: recipients.length },
      });
      reply.status(202);
      return { queued: true, estimatedRecipients: recipients.length };
    },
  );

  app.get(
    '/notifications',
    { preHandler: [app.requireCapability('notifications:send')] },
    async (request) => {
      const query = parseQuery(request, paginationSchema);
      const { skip, take } = skipTake(query);
      const [items, total] = await Promise.all([
        prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, skip, take }),
        prisma.notification.count(),
      ]);
      return paginate(items, total, query);
    },
  );

  app.get(
    '/notifications/devices',
    { preHandler: [app.requireCapability('notifications:send')] },
    async () => {
      const grouped = await prisma.deviceToken.groupBy({
        by: ['platform', 'provider', 'isActive'],
        _count: { _all: true },
      });
      return {
        items: grouped.map((row) => ({
          platform: row.platform,
          provider: row.provider,
          isActive: row.isActive,
          count: row._count._all,
        })),
      };
    },
  );

  // ── API providers ─────────────────────────────────────────────────────────
  app.get('/providers', { preHandler: [app.requireCapability('providers:write')] }, async () => {
    const providers = await prisma.apiProvider.findMany({ orderBy: { priority: 'asc' } });
    return {
      available: AVAILABLE_PROVIDERS,
      items: providers.map((provider) => ({
        id: provider.id,
        slug: provider.slug,
        name: provider.name,
        kind: provider.kind,
        baseUrl: provider.baseUrl,
        // The stored key is AES-encrypted and never returned, only its shape.
        apiKeyPreview: provider.apiKeyEncrypted ? maskSecret(provider.apiKeyEncrypted, 3) : null,
        hasApiKey: Boolean(provider.apiKeyEncrypted),
        isActive: provider.isActive,
        priority: provider.priority,
        pollIntervalSeconds: provider.pollIntervalSeconds,
        rateLimitPerMinute: provider.rateLimitPerMinute,
        enabledSports: provider.enabledSports,
        enabledLeagueIds: provider.enabledLeagueIds,
        config: provider.config,
        lastSyncAt: provider.lastSyncAt,
        lastError: provider.lastError,
      })),
    };
  });

  app.post(
    '/providers',
    { preHandler: [app.requireCapability('providers:write')] },
    async (request, reply) => {
      const input = parseBody(request, upsertApiProviderSchema);
      const provider = await prisma.apiProvider.upsert({
        where: { slug: input.slug },
        create: {
          slug: input.slug,
          name: input.name,
          kind: input.kind,
          baseUrl: input.baseUrl ?? null,
          apiKeyEncrypted: input.apiKey ? encryptSecret(input.apiKey, env.ENCRYPTION_KEY) : null,
          isActive: input.isActive,
          priority: input.priority,
          pollIntervalSeconds: input.pollIntervalSeconds,
          rateLimitPerMinute: input.rateLimitPerMinute,
          enabledSports: input.enabledSports,
          enabledLeagueIds: input.enabledLeagueIds,
          config: input.config as never,
        },
        update: {
          name: input.name,
          kind: input.kind,
          baseUrl: input.baseUrl ?? null,
          // Only replace the stored key when a new one was supplied.
          ...(input.apiKey
            ? { apiKeyEncrypted: encryptSecret(input.apiKey, env.ENCRYPTION_KEY) }
            : {}),
          isActive: input.isActive,
          priority: input.priority,
          pollIntervalSeconds: input.pollIntervalSeconds,
          rateLimitPerMinute: input.rateLimitPerMinute,
          enabledSports: input.enabledSports,
          enabledLeagueIds: input.enabledLeagueIds,
          config: input.config as never,
        },
      });

      await audit(request, {
        action: 'provider.upserted',
        entityType: 'ApiProvider',
        entityId: provider.id,
        // The plaintext key is deliberately excluded from the audit record.
        after: { ...input, apiKey: input.apiKey ? '[set]' : undefined },
      });
      reply.status(201);
      return { id: provider.id, slug: provider.slug, isActive: provider.isActive };
    },
  );

  app.post(
    '/providers/:slug/test',
    { preHandler: [app.requireCapability('providers:write')] },
    async (request) => {
      const { slug } = request.params as { slug: string };
      const { provider, fellBack } = await sync.resolveProvider(slug);
      const health = await provider.healthCheck();
      return { ...health, fellBack };
    },
  );

  app.post(
    '/providers/sync/:kind',
    { preHandler: [app.requireCapability('providers:write')] },
    async (request, reply) => {
      const { kind } = request.params as { kind: string };
      switch (kind) {
        case 'fixtures':
          await jobs.syncFixtures();
          break;
        case 'odds':
          await jobs.syncOdds();
          break;
        case 'results':
          await jobs.syncResults();
          break;
        case 'statistics':
          await jobs.recomputeStatistics();
          break;
        default:
          reply.status(400);
          return { error: { code: 'VALIDATION_ERROR', message: `Unknown sync kind "${kind}"` } };
      }
      await audit(request, {
        action: 'provider.sync_requested',
        entityType: 'ApiProvider',
        after: { kind },
      });
      reply.status(202);
      return { queued: true, kind };
    },
  );

  // ── settings ──────────────────────────────────────────────────────────────
  app.get('/settings', { preHandler: [app.requireCapability('settings:write')] }, async () => ({
    items: await prisma.appSetting.findMany({ orderBy: { key: 'asc' } }),
  }));

  app.put(
    '/settings',
    { preHandler: [app.requireCapability('settings:write')] },
    async (request) => {
      const input = parseBody(request, updateSettingsSchema);
      const setting = await prisma.appSetting.upsert({
        where: { key: input.key },
        create: { key: input.key, value: input.value as never },
        update: { value: input.value as never },
      });
      await audit(request, {
        action: 'setting.updated',
        entityType: 'AppSetting',
        entityId: input.key,
        after: input,
      });
      return setting;
    },
  );

  app.get(
    '/referral-program',
    { preHandler: [app.requireCapability('settings:write')] },
    async () => referrals.program(),
  );

  app.put(
    '/referral-program',
    { preHandler: [app.requireCapability('settings:write')] },
    async (request) => {
      const input = parseBody(request, referralProgramSchema);
      const saved = await referrals.saveProgram(input);
      await audit(request, {
        action: 'referral_program.updated',
        entityType: 'AppSetting',
        after: input,
      });
      return saved;
    },
  );

  // ── audit log ─────────────────────────────────────────────────────────────
  app.get('/logs', { preHandler: [app.requireCapability('logs:read')] }, async (request) => {
    const query = parseQuery(request, paginationSchema);
    const { skip, take } = skipTake(query);
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.auditLog.count(),
    ]);
    return paginate(items, total, query);
  });

  app.get('/logs/:id', { preHandler: [app.requireCapability('logs:read')] }, async (request) => {
    const { id } = parseParams(request, idParamSchema);
    return assertFound(await prisma.auditLog.findUnique({ where: { id } }), 'Audit log');
  });

  // ── statistics maintenance ────────────────────────────────────────────────
  app.post(
    '/statistics/recompute',
    { preHandler: [app.requireCapability('statistics:read')] },
    async (request, reply) => {
      await statistics.invalidate();
      await jobs.recomputeStatistics();
      await audit(request, { action: 'statistics.recompute', entityType: 'StatisticsSnapshot' });
      reply.status(202);
      return { queued: true };
    },
  );
}
