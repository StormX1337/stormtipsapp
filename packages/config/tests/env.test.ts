import { describe, expect, it } from 'vitest';
import { envSchema, isDevelopment, isProduction, isTest, loadEnv, type Env } from '../src/index.js';

/** Minimal valid environment; individual tests override single keys. */
const base: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/storm_tips',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  ENCRYPTION_KEY: 'c'.repeat(64),
};

describe('environment schema', () => {
  it('accepts a minimal configuration and fills in defaults', () => {
    const env = loadEnv({ ...base });
    expect(env.API_PORT).toBe(4000);
    expect(env.DEFAULT_CURRENCY).toBe('EUR');
    expect(env.DEFAULT_LOCALE).toBe('de');
    expect(env.SPORTS_PROVIDER).toBe('mock');
    expect(env.STATISTICS_STAKE).toBe(10);
  });

  it('requires the secrets the application cannot run without', () => {
    for (const key of [
      'DATABASE_URL',
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'ENCRYPTION_KEY',
    ]) {
      const broken = { ...base };
      delete broken[key];
      expect(() => loadEnv(broken), key).toThrow(/Invalid environment configuration/);
    }
  });

  it('rejects a short signing secret', () => {
    expect(() => loadEnv({ ...base, JWT_ACCESS_SECRET: 'too-short' })).toThrow(
      /at least 32 characters/,
    );
  });

  it('rejects an encryption key that is not 32 bytes of hex', () => {
    expect(() => loadEnv({ ...base, ENCRYPTION_KEY: 'zz' })).toThrow(/64 hexadecimal/);
    expect(() => loadEnv({ ...base, ENCRYPTION_KEY: 'g'.repeat(64) })).toThrow(/64 hexadecimal/);
  });

  it('parses the CORS allowlist into trimmed entries', () => {
    const env = loadEnv({
      ...base,
      CORS_ORIGINS: 'http://localhost:3000, http://localhost:3001 ,,',
    });
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000', 'http://localhost:3001']);
  });

  it('coerces booleans from the usual string spellings', () => {
    expect(loadEnv({ ...base, METRICS_ENABLED: 'false' }).METRICS_ENABLED).toBe(false);
    expect(loadEnv({ ...base, METRICS_ENABLED: 'yes' }).METRICS_ENABLED).toBe(true);
    expect(loadEnv({ ...base, APNS_PRODUCTION: '1' }).APNS_PRODUCTION).toBe(true);
    expect(loadEnv({ ...base, SMTP_SECURE: 'off' }).SMTP_SECURE).toBe(false);
  });

  it('rejects an unknown sports provider and an invalid public URL', () => {
    expect(() => loadEnv({ ...base, SPORTS_PROVIDER: 'guesswork' })).toThrow();
    expect(() => loadEnv({ ...base, API_PUBLIC_URL: 'not-a-url' })).toThrow();
  });

  it('reports every problem at once', () => {
    const result = envSchema.safeParse({ NODE_ENV: 'test' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'));
      expect(paths).toContain('DATABASE_URL');
      expect(paths).toContain('JWT_ACCESS_SECRET');
      expect(paths).toContain('ENCRYPTION_KEY');
    }
  });

  it('classifies the runtime mode', () => {
    const env = (mode: string): Env => loadEnv({ ...base, NODE_ENV: mode });
    expect(isProduction(env('production'))).toBe(true);
    expect(isDevelopment(env('development'))).toBe(true);
    expect(isTest(env('test'))).toBe(true);
    expect(isProduction(env('staging'))).toBe(false);
  });
});
