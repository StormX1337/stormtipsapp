import type { FastifyRequest } from 'fastify';
import type { z } from 'zod';
import { AppError, ErrorCode } from '@storm-tips/types';

function parse<T extends z.ZodType>(schema: T, value: unknown, source: string): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, `Invalid ${source}`, {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      })),
    });
  }
  return result.data;
}

/** Validates and returns the request body. Never mutates the raw request. */
export function parseBody<T extends z.ZodType>(request: FastifyRequest, schema: T): z.infer<T> {
  return parse(schema, request.body ?? {}, 'request body');
}

export function parseQuery<T extends z.ZodType>(request: FastifyRequest, schema: T): z.infer<T> {
  return parse(schema, request.query ?? {}, 'query string');
}

export function parseParams<T extends z.ZodType>(request: FastifyRequest, schema: T): z.infer<T> {
  return parse(schema, request.params ?? {}, 'path parameters');
}
