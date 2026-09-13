import { prisma } from '@profit-tips/database';
import type { FastifyRequest } from 'fastify';
import { logger } from './logger.js';

export interface AuditInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

/**
 * Records a privileged mutation.
 *
 * Audit writes must never fail the request they describe, so errors are logged
 * and swallowed — but they are logged at `error` level so they are alertable.
 */
export async function audit(request: FastifyRequest, input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: request.auth?.userId ?? null,
        actorEmail: request.auth?.email ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        before: (input.before ?? null) as never,
        after: (input.after ?? null) as never,
        ip: request.ip,
        userAgent: request.headers['user-agent']?.slice(0, 300) ?? null,
      },
    });
  } catch (error) {
    logger.error({ err: error, action: input.action }, 'failed to write audit log');
  }
}
