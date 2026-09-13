import fp from 'fastify-plugin';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppError, ErrorCode, ERROR_STATUS, isAppError } from '@profit-tips/types';
import { env } from '../lib/env.js';

interface PrismaLikeError {
  code?: string;
  meta?: { target?: string[]; cause?: string };
}

/** Maps Prisma's error codes onto our stable API error codes. */
function fromPrisma(error: unknown): AppError | null {
  const candidate = error as PrismaLikeError;
  if (typeof candidate?.code !== 'string' || !candidate.code.startsWith('P')) return null;
  switch (candidate.code) {
    case 'P2002':
      return AppError.conflict('A record with these values already exists', {
        fields: candidate.meta?.target ?? [],
      });
    case 'P2025':
      return AppError.notFound('Record');
    case 'P2003':
      return new AppError(ErrorCode.VALIDATION_ERROR, 'Referenced record does not exist');
    case 'P1001':
    case 'P1002':
      return new AppError(ErrorCode.SERVICE_UNAVAILABLE, 'Database is unreachable');
    default:
      return null;
  }
}

export const errorHandlerPlugin = fp(async function errorHandlerPlugin(app: FastifyInstance) {
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    reply.status(404).send({
      error: {
        code: ErrorCode.NOT_FOUND,
        message: `Route ${request.method} ${request.url} not found`,
        requestId: request.id,
      },
    });
  });

  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const appError = isAppError(error) ? error : fromPrisma(error);

    if (appError) {
      if (appError.statusCode >= 500) {
        request.log.error({ err: error }, appError.message);
      } else {
        request.log.info({ code: appError.code, msg: appError.message }, 'request rejected');
      }
      reply.status(appError.statusCode).send({
        error: {
          code: appError.code,
          message: appError.message,
          details: appError.details,
          requestId: request.id,
        },
      });
      return;
    }

    // Fastify's own errors (payload too large, malformed JSON, rate limit…)
    if (typeof error.statusCode === 'number' && error.statusCode < 500) {
      const code =
        error.statusCode === 429
          ? ErrorCode.RATE_LIMITED
          : error.statusCode === 401
            ? ErrorCode.UNAUTHORIZED
            : ErrorCode.VALIDATION_ERROR;
      reply.status(error.statusCode).send({
        error: { code, message: error.message, requestId: request.id },
      });
      return;
    }

    request.log.error({ err: error }, 'unhandled error');
    reply.status(ERROR_STATUS.INTERNAL_ERROR).send({
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message:
          env.NODE_ENV === 'production'
            ? 'Internal server error'
            : (error.message ?? 'Internal server error'),
        requestId: request.id,
      },
    });
  });
});
