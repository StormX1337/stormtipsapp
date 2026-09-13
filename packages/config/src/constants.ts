/** Application-wide constants that are not environment specific. */

export const APP_NAME = 'PROFIT TIPS';
export const APP_SLUG = 'profit-tips';
export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

/** Supported interface languages. */
export const SUPPORTED_LOCALES = ['de', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** Supported billing currencies. */
export const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'GBP'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
};

/** Premium products sold by the platform. FREE is the always-available tier. */
export const PREMIUM_PRODUCTS = ['VIP', 'EXTRA', 'COMBO', 'FIX_ODDS'] as const;
export type PremiumProduct = (typeof PREMIUM_PRODUCTS)[number];

export const ALL_PRODUCTS = ['FREE', ...PREMIUM_PRODUCTS] as const;

/** Statistics windows offered in the UI, mapped to a day count (null = all time). */
export const STATS_WINDOWS = {
  D7: 7,
  D30: 30,
  D90: 90,
  M6: 182,
  M12: 365,
  ALL: null,
} as const;
export type StatsWindowKey = keyof typeof STATS_WINDOWS;

/** Cache TTLs in seconds. */
export const CACHE_TTL = {
  statistics: 300,
  tipFeed: 30,
  liveEvents: 5,
  plans: 600,
  promotions: 300,
  leagues: 3600,
} as const;

/** Redis key namespaces — keep every key construction in one place. */
export const REDIS_KEYS = {
  statistics: (product: string, window: string) => `stats:${product}:${window}`,
  tipFeed: (product: string, date: string) => `feed:${product}:${date}`,
  liveEvents: () => 'live:events',
  entitlements: (userId: string) => `ent:${userId}`,
  rateLimit: (bucket: string, key: string) => `rl:${bucket}:${key}`,
  plans: () => 'plans:active',
  providerQuota: (slug: string) => `provider:quota:${slug}`,
} as const;

/** Redis pub/sub channels used to fan WebSocket messages across API instances. */
export const REDIS_CHANNELS = {
  broadcast: 'pt:broadcast',
} as const;

/** BullMQ queue names. */
export const QUEUE_NAMES = {
  sports: 'sports-sync',
  odds: 'odds-sync',
  results: 'results-sync',
  tips: 'tips-lifecycle',
  statistics: 'statistics',
  notifications: 'notifications',
  subscriptions: 'subscriptions',
  maintenance: 'maintenance',
} as const;

/** Default flat stake (in currency units) used for every ROI/profit calculation. */
export const DEFAULT_STAKE = 10;

/** Pagination guard rails. */
export const PAGINATION = {
  defaultLimit: 20,
  maxLimit: 100,
} as const;

/** Expo push API hard limit: at most 100 messages per request. */
export const EXPO_PUSH_CHUNK_SIZE = 100;

/** Minimum age required to use the product, by jurisdiction default. */
export const MINIMUM_AGE = 18;
