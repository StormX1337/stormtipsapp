import { pino, type Logger } from 'pino';
import { env } from './env.js';

/**
 * Structured logger.
 *
 * `redact` removes credentials from request/response logs — this is the single
 * most important guard against leaking tokens into log aggregation.
 */
export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'req.headers["stripe-signature"]',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.newPassword',
      '*.currentPassword',
      '*.refreshToken',
      '*.accessToken',
      '*.idToken',
      '*.receipt',
      '*.apiKey',
      '*.apiKeyEncrypted',
      'body.password',
      'body.refreshToken',
      'body.receipt',
    ],
    censor: '[redacted]',
  },
  base: { service: 'storm-tips-api', env: env.NODE_ENV },
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss.l' } }
      : undefined,
});
