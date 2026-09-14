import { AppError, ErrorCode } from '@storm-tips/types';
import type { SportsDataProvider } from './provider.js';
import type { ProviderConfig } from './types.js';
import { MockProvider } from './providers/mock.js';
import { SportsGameOddsProvider } from './providers/sportsgameodds.js';
import { TheOddsApiProvider } from './providers/theoddsapi.js';

export type ProviderSlug = 'mock' | 'sportsgameodds' | 'theoddsapi';

type Factory = (config: ProviderConfig) => SportsDataProvider;

/**
 * Provider registry.
 *
 * New vendors are added here and nowhere else — the API, the worker and the
 * admin console all resolve providers through `createProvider`.
 */
const FACTORIES: Record<ProviderSlug, Factory> = {
  mock: (config) => new MockProvider(config),
  sportsgameodds: (config) => new SportsGameOddsProvider(config),
  theoddsapi: (config) => new TheOddsApiProvider(config),
};

export const AVAILABLE_PROVIDERS: {
  slug: ProviderSlug;
  name: string;
  requiresApiKey: boolean;
  docsUrl: string;
}[] = [
  { slug: 'mock', name: 'Mock provider (offline)', requiresApiKey: false, docsUrl: '' },
  {
    slug: 'sportsgameodds',
    name: 'SportsGameOdds',
    requiresApiKey: true,
    docsUrl: 'https://sportsgameodds.com/docs',
  },
  {
    slug: 'theoddsapi',
    name: 'The Odds API',
    requiresApiKey: true,
    docsUrl: 'https://the-odds-api.com/liveapi/guides/v4/',
  },
];

export function isProviderSlug(value: string): value is ProviderSlug {
  return value in FACTORIES;
}

export function createProvider(config: ProviderConfig): SportsDataProvider {
  const slug = config.slug as ProviderSlug;
  const factory = FACTORIES[slug];
  if (!factory) {
    throw new AppError(ErrorCode.PROVIDER_ERROR, `Unknown sports provider "${config.slug}"`);
  }
  const descriptor = AVAILABLE_PROVIDERS.find((entry) => entry.slug === slug);
  if (descriptor?.requiresApiKey && !config.apiKey) {
    throw new AppError(
      ErrorCode.PROVIDER_ERROR,
      `Provider "${slug}" requires an API key. Add it in Admin → API Providers, or set SPORTS_API_KEY.`,
    );
  }
  return factory(config);
}

/**
 * Resolves the provider to use, falling back to the offline mock provider when
 * the configured one cannot be constructed. The fallback is reported so the
 * caller can surface it in the admin console instead of failing silently.
 */
export function createProviderWithFallback(config: ProviderConfig): {
  provider: SportsDataProvider;
  fellBack: boolean;
  reason?: string;
} {
  try {
    return { provider: createProvider(config), fellBack: false };
  } catch (error) {
    return {
      provider: new MockProvider(config),
      fellBack: true,
      reason: error instanceof Error ? error.message : 'unknown error',
    };
  }
}
