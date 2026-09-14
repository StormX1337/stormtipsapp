import type { BillingInterval, ProductCode, PromoBadge } from '@storm-tips/types';

/**
 * Commercial catalogue for the development seed.
 *
 * Prices mirror the reference screenshot (29,99 € / 79,99 € / 139,99 € and the
 * 39,99 € bundle) but nothing here is hardcoded in the application itself —
 * every value lives in the `subscription_plans` table and is editable in the
 * admin console.
 */

export interface SeedPlan {
  slug: string;
  name: string;
  description: string;
  products: ProductCode[];
  priceCents: number;
  compareAtPriceCents?: number;
  interval: BillingInterval;
  intervalCount: number;
  trialDays: number;
  badge: PromoBadge;
  highlight?: string;
  isPopular: boolean;
  sortOrder: number;
  stripePriceId: string;
  appleProductId: string;
  googleProductId: string;
}

export const SEED_PLANS: SeedPlan[] = [
  {
    slug: 'combo-1m',
    name: 'Combo · 1 month',
    description: 'Access to every Combo analysis for one month.',
    products: ['COMBO'],
    priceCents: 2999,
    interval: 'MONTH',
    intervalCount: 1,
    trialDays: 0,
    badge: 'NONE',
    isPopular: false,
    sortOrder: 10,
    stripePriceId: 'price_dev_combo_1m',
    appleProductId: 'app.stormtips.combo.1m',
    googleProductId: 'combo_1m',
  },
  {
    slug: 'combo-3m',
    name: 'Combo · 3 months',
    description: 'Three months of Combo — cheaper per month.',
    products: ['COMBO'],
    priceCents: 7999,
    compareAtPriceCents: 8997,
    interval: 'MONTH',
    intervalCount: 3,
    trialDays: 0,
    badge: 'SALE',
    isPopular: false,
    sortOrder: 20,
    stripePriceId: 'price_dev_combo_3m',
    appleProductId: 'app.stormtips.combo.3m',
    googleProductId: 'combo_3m',
  },
  {
    slug: 'combo-6m',
    name: 'Combo · 6 months',
    description: 'Six months of Combo at the best monthly price.',
    products: ['COMBO'],
    priceCents: 13999,
    compareAtPriceCents: 17994,
    interval: 'MONTH',
    intervalCount: 6,
    trialDays: 0,
    badge: 'BEST_VALUE',
    isPopular: false,
    sortOrder: 30,
    stripePriceId: 'price_dev_combo_6m',
    appleProductId: 'app.stormtips.combo.6m',
    googleProductId: 'combo_6m',
  },
  {
    slug: 'bundle-1m',
    name: 'Combo + VIP + Extra',
    description: 'Every premium product in one subscription.',
    products: ['COMBO', 'VIP', 'EXTRA'],
    priceCents: 3999,
    compareAtPriceCents: 6197,
    interval: 'MONTH',
    intervalCount: 1,
    trialDays: 0,
    badge: 'MOST_POPULAR',
    highlight: 'Spare 21,98 €',
    isPopular: true,
    sortOrder: 5,
    stripePriceId: 'price_dev_bundle_1m',
    appleProductId: 'app.stormtips.bundle.1m',
    googleProductId: 'bundle_1m',
  },
  {
    slug: 'vip-1m',
    name: 'VIP · 1 month',
    description: 'Every VIP analysis, live tips and expert commentary.',
    products: ['VIP'],
    priceCents: 2499,
    interval: 'MONTH',
    intervalCount: 1,
    trialDays: 3,
    badge: 'NONE',
    isPopular: false,
    sortOrder: 40,
    stripePriceId: 'price_dev_vip_1m',
    appleProductId: 'app.stormtips.vip.1m',
    googleProductId: 'vip_1m',
  },
  {
    slug: 'vip-12m',
    name: 'VIP · 12 months',
    description: 'A year of VIP at a reduced monthly price.',
    products: ['VIP'],
    priceCents: 19999,
    compareAtPriceCents: 29988,
    interval: 'MONTH',
    intervalCount: 12,
    trialDays: 0,
    badge: 'SALE',
    isPopular: false,
    sortOrder: 50,
    stripePriceId: 'price_dev_vip_12m',
    appleProductId: 'app.stormtips.vip.12m',
    googleProductId: 'vip_12m',
  },
  {
    slug: 'extra-1m',
    name: 'Extra · 1 month',
    description: 'Value and special selections at higher odds.',
    products: ['EXTRA'],
    priceCents: 1999,
    interval: 'MONTH',
    intervalCount: 1,
    trialDays: 0,
    badge: 'NONE',
    isPopular: false,
    sortOrder: 60,
    stripePriceId: 'price_dev_extra_1m',
    appleProductId: 'app.stormtips.extra.1m',
    googleProductId: 'extra_1m',
  },
];

export interface SeedFixOddsPlan {
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  targetOdds: number;
  maxOdds: number;
  minConfidence: number;
  picksPerPeriod: number;
  allowLive: boolean;
  requiresVip: boolean;
  badge: PromoBadge;
  sortOrder: number;
  stripePriceId: string;
  appleProductId: string;
  googleProductId: string;
}

export const SEED_FIX_ODDS_PLANS: SeedFixOddsPlan[] = [
  {
    slug: 'fix-odds-basic',
    name: 'FIX ODDS BASIC',
    description: 'A conservative package targeting 1.50 at high confidence.',
    priceCents: 1999,
    targetOdds: 1.5,
    maxOdds: 1.8,
    minConfidence: 75,
    picksPerPeriod: 20,
    allowLive: false,
    requiresVip: false,
    badge: 'NONE',
    sortOrder: 10,
    stripePriceId: 'price_dev_fix_basic',
    appleProductId: 'app.stormtips.fix.basic',
    googleProductId: 'fix_basic',
  },
  {
    slug: 'fix-odds-pro',
    name: 'FIX ODDS PRO',
    description: 'A balanced package targeting 2.00.',
    priceCents: 3499,
    targetOdds: 2,
    maxOdds: 2.6,
    minConfidence: 65,
    picksPerPeriod: 16,
    allowLive: true,
    requiresVip: false,
    badge: 'MOST_POPULAR',
    sortOrder: 20,
    stripePriceId: 'price_dev_fix_pro',
    appleProductId: 'app.stormtips.fix.pro',
    googleProductId: 'fix_pro',
  },
  {
    slug: 'fix-odds-vip',
    name: 'FIX ODDS VIP',
    description: 'Targeting 3.00 — VIP members only.',
    priceCents: 4999,
    targetOdds: 3,
    maxOdds: 4,
    minConfidence: 60,
    picksPerPeriod: 12,
    allowLive: true,
    requiresVip: true,
    badge: 'LIMITED',
    sortOrder: 30,
    stripePriceId: 'price_dev_fix_vip',
    appleProductId: 'app.stormtips.fix.vip',
    googleProductId: 'fix_vip',
  },
  {
    slug: 'fix-odds-combo',
    name: 'FIX ODDS COMBO',
    description: 'Accumulators targeting 5.00, for members who accept more variance.',
    priceCents: 5999,
    targetOdds: 5,
    maxOdds: 8,
    minConfidence: 55,
    picksPerPeriod: 8,
    allowLive: false,
    requiresVip: false,
    badge: 'NEW',
    sortOrder: 40,
    stripePriceId: 'price_dev_fix_combo',
    appleProductId: 'app.stormtips.fix.combo',
    googleProductId: 'fix_combo',
  },
];

export const SEED_PRODUCTS: {
  code: ProductCode;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  color: string;
  benefits: string[];
  sortOrder: number;
}[] = [
  {
    code: 'FREE',
    name: 'Storm Tips Free',
    tagline: 'Free analyses every day',
    description:
      'Several published analyses every day, each with odds, market and a written rationale.',
    icon: 'list',
    color: '#12E17F',
    benefits: [
      'Several analyses per day',
      'Odds and the bookmaker they came from',
      'Complete results history',
    ],
    sortOrder: 0,
  },
  {
    code: 'COMBO',
    name: 'Storm Tips Combo',
    tagline: 'Curated accumulators',
    description: 'Daily accumulators, with every selection reasoned individually.',
    icon: 'ticket',
    color: '#FFC93C',
    benefits: [
      'Daily accumulator analyses',
      'Every selection reasoned individually',
      'Automatic accumulator settlement',
      'Verified performance record',
    ],
    sortOrder: 1,
  },
  {
    code: 'EXTRA',
    name: 'Storm Tips Extra',
    tagline: 'Value and special selections',
    description: 'Selected value spots, special markets and in-play opportunities.',
    icon: 'zap',
    color: '#28D8F5',
    benefits: [
      'Value selections at higher odds',
      'Special markets',
      'In-play opportunities',
      'Profit and loss impact per selection',
    ],
    sortOrder: 2,
  },
  {
    code: 'VIP',
    name: 'Storm Tips VIP',
    tagline: 'Highest confidence',
    description: 'The highest-confidence selections, each with a detailed analysis.',
    icon: 'crown',
    color: '#FFD65C',
    benefits: [
      'Highest-confidence analyses',
      'Detailed expert reasoning',
      'Published earlier',
      'Extended statistics',
      'Live tips',
    ],
    sortOrder: 3,
  },
  {
    code: 'FIX_ODDS',
    name: 'Storm Tips FIX Odds',
    tagline: 'Packages built around a target price',
    description: 'Packages aimed consistently at a defined target price.',
    icon: 'target',
    color: '#8B5CF6',
    benefits: [
      'A defined target price per package',
      'A fixed number of selections per period',
      'A defined minimum confidence per selection',
      'Separate statistics per package',
    ],
    sortOrder: 4,
  },
];

export const SEED_MARKETS = [
  { key: '1x2', type: 'MATCH_WINNER', name: 'Match winner', hasLine: false, sortOrder: 1 },
  {
    key: 'double-chance',
    type: 'DOUBLE_CHANCE',
    name: 'Double chance',
    hasLine: false,
    sortOrder: 2,
  },
  { key: 'dnb', type: 'DRAW_NO_BET', name: 'Draw no bet', hasLine: false, sortOrder: 3 },
  { key: 'totals', type: 'OVER_UNDER', name: 'Total goals', hasLine: true, sortOrder: 4 },
  {
    key: 'alt-totals',
    type: 'OVER_UNDER',
    name: 'Alternative goal line',
    hasLine: true,
    sortOrder: 5,
  },
  { key: 'team-totals', type: 'TEAM_TOTAL', name: 'Team total', hasLine: true, sortOrder: 6 },
  {
    key: 'asian-handicap',
    type: 'ASIAN_HANDICAP',
    name: 'Asian handicap',
    hasLine: true,
    sortOrder: 7,
  },
  {
    key: 'european-handicap',
    type: 'EUROPEAN_HANDICAP',
    name: 'European handicap',
    hasLine: true,
    sortOrder: 8,
  },
  { key: 'btts', type: 'BTTS', name: 'Both teams to score', hasLine: false, sortOrder: 9 },
  {
    key: 'ht-totals',
    type: 'HALF_OVER_UNDER',
    name: 'First half totals',
    hasLine: true,
    sortOrder: 10,
  },
  { key: 'corners', type: 'CORNERS', name: 'Total corners', hasLine: true, sortOrder: 11 },
  { key: 'cards', type: 'CARDS', name: 'Total cards', hasLine: true, sortOrder: 12 },
  {
    key: 'correct-score',
    type: 'CORRECT_SCORE',
    name: 'Correct score',
    hasLine: false,
    sortOrder: 13,
  },
  { key: 'ht-ft', type: 'HT_FT', name: 'Half time / full time', hasLine: false, sortOrder: 14 },
] as const;

export const SEED_COUPONS = [
  {
    code: 'WELCOME20',
    description: '20% off your first subscription.',
    discountType: 'PERCENTAGE' as const,
    discountValue: 20,
    maxRedemptions: 1000,
    maxRedemptionsPerUser: 1,
    minPurchaseCents: 0,
    applicableProducts: [] as ProductCode[],
  },
  {
    code: 'COMBO10',
    description: '€10 off every Combo plan.',
    discountType: 'FIXED' as const,
    discountValue: 1000,
    maxRedemptions: 500,
    maxRedemptionsPerUser: 1,
    minPurchaseCents: 2999,
    applicableProducts: ['COMBO'] as ProductCode[],
  },
  {
    code: 'VIPWEEK',
    description: '30% off VIP — for a limited time.',
    discountType: 'PERCENTAGE' as const,
    discountValue: 30,
    maxRedemptions: 200,
    maxRedemptionsPerUser: 1,
    minPurchaseCents: 0,
    applicableProducts: ['VIP'] as ProductCode[],
  },
];
