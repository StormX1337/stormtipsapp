import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import type { FastifyInstance } from 'fastify';
import { ErrorCode } from '@profit-tips/types';
import { env } from '../lib/env.js';
import { redis } from '../lib/redis.js';

export const securityPlugin = fp(async function securityPlugin(app: FastifyInstance) {
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts:
      env.NODE_ENV === 'production'
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });

  const allowed = new Set(env.CORS_ORIGINS);
  await app.register(cors, {
    /**
     * Strict allowlist. Requests with no Origin (server-to-server, mobile apps,
     * curl) are permitted because CORS is a browser protection and those
     * clients are authenticated by bearer token instead.
     */
    origin(origin, callback) {
      if (!origin || allowed.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by CORS policy'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization', 'x-request-id', 'x-internal-token'],
    exposedHeaders: ['x-request-id'],
    maxAge: 86_400,
  });

  await app.register(cookie, {
    parseOptions: { httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production' },
  });

  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    redis,
    nameSpace: 'pt-rl:',
    // Authenticated callers get their own bucket so one NAT cannot exhaust another user's quota.
    keyGenerator: (request) => request.auth?.userId ?? request.ip,
    allowList: (request) => request.url === '/health' || request.url === '/ready',
    errorResponseBuilder: (request, context) => ({
      error: {
        code: ErrorCode.RATE_LIMITED,
        message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)}s.`,
        requestId: request.id,
      },
    }),
  });
});
