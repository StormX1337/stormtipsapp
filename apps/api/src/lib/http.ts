import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError, ErrorCode, type Paginated } from '@storm-tips/types';
import { PAGINATION } from '@storm-tips/config';

export interface PageParams {
  page: number;
  limit: number;
}

export function paginate<T>(items: T[], total: number, params: PageParams): Paginated<T> {
  const limit = Math.min(Math.max(params.limit, 1), PAGINATION.maxLimit);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    items,
    page: params.page,
    limit,
    total,
    totalPages,
    hasNext: params.page < totalPages,
  };
}

export function skipTake(params: PageParams): { skip: number; take: number } {
  const limit = Math.min(Math.max(params.limit, 1), PAGINATION.maxLimit);
  return { skip: (params.page - 1) * limit, take: limit };
}

/** Best-effort client IP, honouring the proxy header Fastify already parsed. */
export function clientIp(request: FastifyRequest): string {
  return request.ip ?? 'unknown';
}

export function noStore(reply: FastifyReply): FastifyReply {
  return reply.header('cache-control', 'no-store, private');
}

/**
 * Marks a response as publicly cacheable.
 *
 * `Vary` is not optional here: these payloads carry editorial content in the
 * requested language, so without it a browser or CDN would happily serve a
 * German response to an English reader.
 */
export function publicCache(reply: FastifyReply, seconds: number): FastifyReply {
  return reply
    .header('cache-control', `public, max-age=${seconds}, stale-while-revalidate=30`)
    .header('vary', 'authorization');
}

export function assertFound<T>(value: T | null | undefined, entity: string): T {
  if (value === null || value === undefined) throw AppError.notFound(entity);
  return value;
}

export function badRequest(message: string, details?: unknown): AppError {
  return new AppError(ErrorCode.VALIDATION_ERROR, message, details);
}
