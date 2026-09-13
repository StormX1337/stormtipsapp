import path from 'node:path';
import fs from 'node:fs';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

/**
 * Loads the nearest `.env` walking up from `process.cwd()` to the repository
 * root. Real deployments inject environment variables directly; the file is a
 * developer convenience only and never overrides an already-set variable.
 */
function bootstrapDotenv(): void {
  if (process.env.PROFIT_TIPS_ENV_LOADED === 'true') return;
  let dir = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) {
      loadDotenv({ path: candidate, override: false, quiet: true });
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  process.env.PROFIT_TIPS_ENV_LOADED = 'true';
}

const bool = z
  .union([z.boolean(), z.string()])
  .transform((value) => (typeof value === 'boolean' ? value : /^(1|true|yes|on)$/i.test(value)));

const csv = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  );

const hex64 = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, 'must be 64 hexadecimal characters (32 bytes)');

export const envSchema = z.object({
  // core
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
  WEB_PUBLIC_URL: z.string().url().default('http://localhost:3000'),
  ADMIN_PUBLIC_URL: z.string().url().default('http://localhost:3001'),
  CORS_ORIGINS: csv,

  // data stores
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // security
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  ENCRYPTION_KEY: hex64,
  INTERNAL_API_TOKEN: z.string().min(16).default('local-development-internal-token'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),

  // oauth
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  APPLE_OAUTH_CLIENT_ID: z.string().optional(),
  APPLE_OAUTH_TEAM_ID: z.string().optional(),
  APPLE_OAUTH_KEY_ID: z.string().optional(),
  APPLE_OAUTH_PRIVATE_KEY: z.string().optional(),

  // stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_SUCCESS_URL: z.string().url().default('http://localhost:3000/billing/success'),
  STRIPE_CANCEL_URL: z.string().url().default('http://localhost:3000/billing/cancelled'),

  // apple iap
  APPLE_BUNDLE_ID: z.string().default('com.profittips.app'),
  APPLE_ISSUER_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),
  APPLE_ENVIRONMENT: z.enum(['Sandbox', 'Production']).default('Sandbox'),

  // google play
  GOOGLE_PLAY_PACKAGE_NAME: z.string().default('com.profittips.app'),
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64: z.string().optional(),
  GOOGLE_PUBSUB_AUDIENCE: z.string().optional(),
  GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL: z.string().optional(),

  // sports providers
  SPORTS_PROVIDER: z.enum(['mock', 'sportsgameodds', 'theoddsapi']).default('mock'),
  SPORTS_API_KEY: z.string().optional(),
  SPORTS_API_BASE_URL: z.string().optional(),
  SPORTS_POLL_INTERVAL_SECONDS: z.coerce.number().int().positive().default(120),
  THEODDSAPI_KEY: z.string().optional(),

  // push
  EXPO_ACCESS_TOKEN: z.string().optional(),
  FCM_SERVICE_ACCOUNT_JSON_BASE64: z.string().optional(),
  FCM_PROJECT_ID: z.string().optional(),
  APNS_KEY_ID: z.string().optional(),
  APNS_TEAM_ID: z.string().optional(),
  APNS_PRIVATE_KEY: z.string().optional(),
  APNS_BUNDLE_ID: z.string().default('com.profittips.app'),
  APNS_PRODUCTION: bool.default(false),

  // email
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: bool.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('PROFIT TIPS <no-reply@profittips.app>'),

  // product defaults
  DEFAULT_CURRENCY: z.enum(['EUR', 'USD', 'GBP']).default('EUR'),
  DEFAULT_LOCALE: z.enum(['de', 'en']).default('de'),
  DEFAULT_TIMEZONE: z.string().default('Europe/Berlin'),
  STATISTICS_STAKE: z.coerce.number().positive().default(10),
  ODDS_MOVEMENT_THRESHOLD: z.coerce.number().positive().default(0.05),

  // observability
  SENTRY_DSN: z.string().optional(),
  METRICS_ENABLED: bool.default(true),

  // seed
  SEED_ADMIN_EMAIL: z.string().email().default('admin@profittips.app'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('ChangeMe!2026'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * Parses and caches the process environment.
 * Throws a readable aggregate error (and exits in production) when invalid —
 * the service must never boot with a half-configured environment.
 */
export function loadEnv(overrides: NodeJS.ProcessEnv = process.env): Env {
  if (cached && overrides === process.env) return cached;
  bootstrapDotenv();

  const parsed = envSchema.safeParse(overrides === process.env ? process.env : overrides);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  if (overrides === process.env) cached = parsed.data;
  return parsed.data;
}

/** Test helper — forces the next `loadEnv()` to re-read `process.env`. */
export function resetEnvCache(): void {
  cached = null;
  delete process.env.PROFIT_TIPS_ENV_LOADED;
}

export const isProduction = (env: Env): boolean => env.NODE_ENV === 'production';
export const isDevelopment = (env: Env): boolean => env.NODE_ENV === 'development';
export const isTest = (env: Env): boolean => env.NODE_ENV === 'test';
