import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: [
      'packages/**/tests/**/*.test.ts',
      'packages/**/src/**/*.test.ts',
      'apps/api/tests/**/*.test.ts',
      'apps/worker/tests/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      // Credential rate limiting is exercised by its own test, not by every
      // other suite that needs to log a fixture user in.
      AUTH_RATE_LIMIT_MAX: '5000',
      RATE_LIMIT_MAX: '100000',
    },
    testTimeout: 20_000,
    hookTimeout: 30_000,
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['packages/*/src/**/*.ts', 'apps/api/src/**/*.ts'],
      exclude: ['**/*.d.ts', '**/index.ts', '**/generated/**'],
    },
  },
});
