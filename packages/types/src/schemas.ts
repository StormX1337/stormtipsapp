import { z } from 'zod';
import { toSupportedLocale } from './localization.js';
import {
  BillingInterval,
  ConfidenceBand,
  DevicePlatform,
  DiscountType,
  EntitlementSource,
  MarketType,
  NotificationType,
  PaymentProvider,
  PollKind,
  PollStatus,
  ProductCode,
  PromoBadge,
  PromotionAudience,
  StatsWindow,
  TipOutcome,
  TipStatus,
  UserRole,
  UserStatus,
} from './enums.js';

const enumValues = <T extends Record<string, string>>(e: T) =>
  Object.values(e) as [string, ...string[]];

export const nativeEnumOf = <T extends Record<string, string>>(e: T) =>
  z.enum(enumValues(e)) as unknown as z.ZodType<T[keyof T]>;

// ── shared ───────────────────────────────────────────────────────────────────

export const idSchema = z.string().min(1).max(64);
export const idParamSchema = z.object({ id: idSchema });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationSchema>;

export const sortSchema = z.object({
  sortBy: z.string().max(40).optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128)
  .refine((value) => /[a-z]/.test(value), 'Password must contain a lowercase letter')
  .refine((value) => /[A-Z]/.test(value), 'Password must contain an uppercase letter')
  .refine((value) => /[0-9]/.test(value), 'Password must contain a digit');

export const emailSchema = z.string().email().max(254).toLowerCase().trim();

// ── auth ─────────────────────────────────────────────────────────────────────

/**
 * A client's language preference.
 *
 * The product ships English only, but an app build from when it shipped two
 * still sends the old value — folding it is kinder than rejecting the whole
 * request over a field that no longer changes anything.
 */
const languageSchema = z.string().max(8).transform(toSupportedLocale).optional();

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().min(2).max(60).optional(),
  language: languageSchema,
  countryCode: z.string().length(2).toUpperCase().optional(),
  timezone: z.string().max(64).optional(),
  referralCode: z.string().min(4).max(32).optional(),
  marketingOptIn: z.boolean().default(false),
  acceptedTerms: z.literal(true, { message: 'Terms must be accepted' }),
  ageConfirmed: z.literal(true, { message: 'You must confirm you are 18 or older' }),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
  deviceName: z.string().max(80).optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(512) });
export const logoutSchema = z.object({
  refreshToken: z.string().min(20).max(512).optional(),
  allDevices: z.boolean().default(false),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(256),
  password: passwordSchema,
});
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});
export const verifyEmailSchema = z.object({ token: z.string().min(20).max(256) });
export const resendVerificationSchema = z.object({ email: emailSchema });

export const oauthSchema = z.object({
  provider: z.enum(['google', 'apple']),
  idToken: z.string().min(20),
  /** Apple only returns the name on the very first authorisation. */
  fullName: z.string().max(80).optional(),
  referralCode: z.string().min(4).max(32).optional(),
});
export type OAuthInput = z.infer<typeof oauthSchema>;

// ── profile ──────────────────────────────────────────────────────────────────

export const notificationPrefsSchema = z.object({
  newTips: z.boolean(),
  vipTips: z.boolean(),
  comboTips: z.boolean(),
  extraTips: z.boolean(),
  fixOddsTips: z.boolean(),
  results: z.boolean(),
  kickoffReminders: z.boolean(),
  subscription: z.boolean(),
  promotions: z.boolean(),
  polls: z.boolean(),
  onlyFavourites: z.boolean(),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(60).nullish(),
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Only letters, digits, dot, dash and underscore')
    .nullish(),
  avatarUrl: z.string().url().max(500).nullish(),
  countryCode: z.string().length(2).toUpperCase().nullish(),
  language: languageSchema,
  timezone: z.string().max(64).optional(),
  currency: z.enum(['EUR', 'USD', 'GBP']).optional(),
  marketingOptIn: z.boolean().optional(),
  notificationPrefs: notificationPrefsSchema.partial().optional(),
  favoriteLeagueIds: z.array(idSchema).max(50).optional(),
  favoriteTeamIds: z.array(idSchema).max(50).optional(),
});

/** Turning a device off again; the token is the only thing that identifies it. */
export const deactivateDeviceSchema = z.object({ token: z.string().min(10).max(2048) });

export const registerDeviceSchema = z.object({
  // A browser's subscription is a JSON object, not a short opaque string,
  // and a push endpoint URL alone can run past 500 characters.
  token: z.string().min(10).max(2048),
  platform: nativeEnumOf(DevicePlatform),
  provider: z.enum(['EXPO', 'FCM', 'APNS', 'WEB_PUSH']).default('EXPO'),
  deviceId: z.string().max(128).optional(),
  deviceName: z.string().max(80).optional(),
  appVersion: z.string().max(24).optional(),
  locale: z.string().max(8).optional(),
});

// ── catalogue queries ────────────────────────────────────────────────────────

export const eventsQuerySchema = paginationSchema.extend({
  sportId: idSchema.optional(),
  leagueId: idSchema.optional(),
  date: isoDateSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: z.string().max(20).optional(),
  live: z.coerce.boolean().optional(),
});

export const oddsQuerySchema = z.object({
  eventId: idSchema,
  marketType: nativeEnumOf(MarketType).optional(),
  bookmakerId: idSchema.optional(),
});

// ── tips ─────────────────────────────────────────────────────────────────────

export const tipFeedQuerySchema = paginationSchema.extend({
  date: isoDateSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sportId: idSchema.optional(),
  leagueId: idSchema.optional(),
  outcome: nativeEnumOf(TipOutcome).optional(),
  live: z.coerce.boolean().optional(),
  includeSettled: z.coerce.boolean().default(true),
});
export type TipFeedQuery = z.infer<typeof tipFeedQuerySchema>;

export const historyQuerySchema = paginationSchema.extend({
  product: nativeEnumOf(ProductCode).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  outcome: nativeEnumOf(TipOutcome).optional(),
  leagueId: idSchema.optional(),
  marketType: nativeEnumOf(MarketType).optional(),
});

export const statisticsQuerySchema = z.object({
  product: z.union([nativeEnumOf(ProductCode), z.literal('ALL')]).default('ALL'),
  window: nativeEnumOf(StatsWindow).default('D30'),
  stake: z.coerce.number().positive().max(10000).optional(),
});

// ── my record ────────────────────────────────────────────────────────────────

/** The window picker on the reader's own record; no product, it is all of them. */
export const recordQuerySchema = z.object({
  window: nativeEnumOf(StatsWindow).default('D30'),
});

/**
 * Following a tip. The stake is optional — left out, the published flat stake
 * is used, which is what most readers will have done.
 */
export const followTipSchema = z.object({
  stake: z.coerce.number().positive().max(1_000_000).optional(),
});
export type FollowTipInput = z.infer<typeof followTipSchema>;

// ── admin: tips ──────────────────────────────────────────────────────────────

const tipBaseSchema = z.object({
  eventId: idSchema,
  marketId: idSchema.optional(),
  marketType: nativeEnumOf(MarketType),
  selectionKey: z.string().min(1).max(40),
  selectionLabel: z.string().min(2).max(120),
  line: z.number().min(-50).max(50).nullish(),
  odds: z.number().min(1.01).max(1000),
  stake: z.number().min(0.1).max(10000).default(10),
  bookmakerId: idSchema.nullish(),
  confidence: z.number().int().min(1).max(100).default(70),
  confidenceBand: nativeEnumOf(ConfidenceBand).optional(),
  product: nativeEnumOf(ProductCode).default('FREE'),
  status: nativeEnumOf(TipStatus).default('DRAFT'),
  isLive: z.boolean().default(false),
  isStandalone: z.boolean().default(true),
  title: z.string().max(140).nullish(),
  analysis: z.string().max(8000).nullish(),
  imageUrl: z.string().url().max(500).nullish(),
  tags: z.array(z.string().min(1).max(24)).max(10).default([]),
  source: z.string().max(120).nullish(),
  publishAt: z.string().datetime().nullish(),
  expiresAt: z.string().datetime().nullish(),
  fixOddsPlanId: idSchema.nullish(),
});

/** Markets whose selection is meaningless without a numeric line. */
const LINE_REQUIRED_MARKETS = [
  'OVER_UNDER',
  'ASIAN_HANDICAP',
  'EUROPEAN_HANDICAP',
  'TEAM_TOTAL',
  'HALF_OVER_UNDER',
  'CORNERS',
  'CARDS',
] as const;

const requireLineForMarket = <T extends { marketType?: string; line?: number | null }>(
  value: T,
): boolean =>
  !value.marketType ||
  !(LINE_REQUIRED_MARKETS as readonly string[]).includes(value.marketType) ||
  (value.line !== null && value.line !== undefined);

export const createTipSchema = tipBaseSchema.refine(requireLineForMarket, {
  message: 'This market requires a line',
  path: ['line'],
});
export type CreateTipInput = z.infer<typeof createTipSchema>;

export const updateTipSchema = tipBaseSchema.partial().refine(requireLineForMarket, {
  message: 'This market requires a line',
  path: ['line'],
});

export const settleTipSchema = z.object({
  outcome: nativeEnumOf(TipOutcome),
  homeScore: z.number().int().min(0).max(99).nullish(),
  awayScore: z.number().int().min(0).max(99).nullish(),
  note: z.string().max(500).nullish(),
});

/**
 * Admin event list.
 *
 * The catalogue page wants the most recent fixtures first; the tip editor wants
 * the ones that have not kicked off yet, soonest first — so the window and the
 * direction are both part of the query rather than baked into the route.
 */
export const adminEventsQuerySchema = paginationSchema.extend({
  /** Only fixtures that have not kicked off yet. */
  upcoming: z.coerce.boolean().optional(),
  search: z.string().max(120).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const adminTipsQuerySchema = paginationSchema.extend({
  product: nativeEnumOf(ProductCode).optional(),
  status: nativeEnumOf(TipStatus).optional(),
  outcome: nativeEnumOf(TipOutcome).optional(),
  leagueId: idSchema.optional(),
  eventId: idSchema.optional(),
  search: z.string().max(120).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

export const importTipsSchema = z.object({
  tips: z.array(createTipSchema).min(1).max(200),
});

// ── admin: combos ────────────────────────────────────────────────────────────

const comboBaseSchema = z.object({
  title: z.string().min(2).max(140),
  subtitle: z.string().max(200).nullish(),
  product: nativeEnumOf(ProductCode).default('COMBO'),
  status: nativeEnumOf(TipStatus).default('DRAFT'),
  stake: z.number().min(0.1).max(10000).default(10),
  analysis: z.string().max(8000).nullish(),
  publishAt: z.string().datetime().nullish(),
  expiresAt: z.string().datetime().nullish(),
  tipIds: z.array(idSchema).min(2).max(15),
});
export const createComboSchema = comboBaseSchema;
export type CreateComboInput = z.infer<typeof createComboSchema>;

export const updateComboSchema = comboBaseSchema.partial();

// ── admin: catalogue ─────────────────────────────────────────────────────────

export const upsertSportSchema = z.object({
  key: z.string().min(2).max(32),
  name: z.string().min(2).max(60),
  icon: z.string().max(60).nullish(),
  sortOrder: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export const upsertLeagueSchema = z.object({
  sportId: idSchema,
  countryId: idSchema.nullish(),
  key: z.string().min(2).max(60),
  name: z.string().min(2).max(80),
  shortName: z.string().max(40).nullish(),
  logoUrl: z.string().url().max(500).nullish(),
  tier: z.number().int().min(1).max(10).default(1),
  season: z.string().max(20).nullish(),
  priority: z.number().int().min(0).max(999).default(100),
  isActive: z.boolean().default(true),
});

export const upsertTeamSchema = z.object({
  sportId: idSchema,
  countryId: idSchema.nullish(),
  leagueId: idSchema.nullish(),
  name: z.string().min(2).max(80),
  shortName: z.string().max(40).nullish(),
  code: z.string().max(6).nullish(),
  logoUrl: z.string().url().max(500).nullish(),
  colorPrimary: z.string().max(9).nullish(),
  colorSecondary: z.string().max(9).nullish(),
});

/**
 * A fixture entered by hand, for a match the data provider does not carry.
 *
 * Both sides accept either an existing team id or a plain name — requiring the
 * operator to create two teams before they can enter one match is the reason
 * this route would go unused. A name that already exists in the league's sport
 * resolves to that team rather than creating a second one.
 *
 * `providerEventId` stays null on purpose: the odds and result syncs select on
 * it, so nothing the provider sends can overwrite a fixture typed in here — and
 * nothing will settle it either. The score is the operator's to enter.
 */
export const createManualEventSchema = z
  .object({
    leagueId: idSchema,
    homeTeamId: idSchema.optional(),
    homeTeamName: z.string().min(2).max(80).optional(),
    awayTeamId: idSchema.optional(),
    awayTeamName: z.string().min(2).max(80).optional(),
    startsAt: z.string().datetime(),
    venue: z.string().max(120).nullish(),
    round: z.string().max(60).nullish(),
    season: z.string().max(20).nullish(),
  })
  .refine((value) => Boolean(value.homeTeamId) !== Boolean(value.homeTeamName), {
    message: 'Give the home team either as an id or as a name, not both',
    path: ['homeTeamName'],
  })
  .refine((value) => Boolean(value.awayTeamId) !== Boolean(value.awayTeamName), {
    message: 'Give the away team either as an id or as a name, not both',
    path: ['awayTeamName'],
  })
  .refine(
    (value) => !value.homeTeamId || !value.awayTeamId || value.homeTeamId !== value.awayTeamId,
    { message: 'A team cannot play itself', path: ['awayTeamId'] },
  )
  .refine(
    (value) =>
      !value.homeTeamName ||
      !value.awayTeamName ||
      value.homeTeamName.trim().toLowerCase() !== value.awayTeamName.trim().toLowerCase(),
    { message: 'A team cannot play itself', path: ['awayTeamName'] },
  );

export type CreateManualEventInput = z.infer<typeof createManualEventSchema>;

export const upsertBookmakerSchema = z.object({
  key: z.string().min(2).max(40),
  name: z.string().min(2).max(60),
  logoUrl: z.string().url().max(500).nullish(),
  website: z.string().url().max(200).nullish(),
  color: z.string().max(9).nullish(),
  priority: z.number().int().min(0).max(999).default(100),
  isActive: z.boolean().default(true),
});

// ── admin: commerce ──────────────────────────────────────────────────────────

export const upsertPlanSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(80),
  description: z.string().max(500).nullish(),
  products: z.array(nativeEnumOf(ProductCode)).min(1),
  priceCents: z.number().int().min(0).max(10_000_00),
  compareAtPriceCents: z.number().int().min(0).max(10_000_00).nullish(),
  currency: z.enum(['EUR', 'USD', 'GBP']).default('EUR'),
  interval: nativeEnumOf(BillingInterval).default('MONTH'),
  intervalCount: z.number().int().min(1).max(36).default(1),
  trialDays: z.number().int().min(0).max(90).default(0),
  badge: nativeEnumOf(PromoBadge).default('NONE'),
  highlight: z.string().max(80).nullish(),
  isPopular: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
  autoRenew: z.boolean().default(true),
  stripePriceId: z.string().max(120).nullish(),
  stripeProductId: z.string().max(120).nullish(),
  appleProductId: z.string().max(120).nullish(),
  googleProductId: z.string().max(120).nullish(),
  googleBasePlanId: z.string().max(120).nullish(),
});
export type UpsertPlanInput = z.infer<typeof upsertPlanSchema>;

export const upsertFixOddsPlanSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(80),
  description: z.string().max(500).nullish(),
  priceCents: z.number().int().min(0).max(10_000_00),
  currency: z.enum(['EUR', 'USD', 'GBP']).default('EUR'),
  interval: nativeEnumOf(BillingInterval).default('MONTH'),
  intervalCount: z.number().int().min(1).max(36).default(1),
  targetOdds: z.number().min(1.01).max(1000),
  maxOdds: z.number().min(1.01).max(1000),
  minConfidence: z.number().int().min(1).max(100).default(60),
  picksPerPeriod: z.number().int().min(1).max(500).default(10),
  sportIds: z.array(idSchema).max(20).default([]),
  leagueIds: z.array(idSchema).max(100).default([]),
  allowLive: z.boolean().default(false),
  requiresVip: z.boolean().default(false),
  badge: nativeEnumOf(PromoBadge).default('NONE'),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
  stripePriceId: z.string().max(120).nullish(),
  appleProductId: z.string().max(120).nullish(),
  googleProductId: z.string().max(120).nullish(),
});

export const upsertCouponSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[A-Z0-9_-]+$/, 'Use A-Z, 0-9, - and _'),
  description: z.string().max(200).nullish(),
  discountType: nativeEnumOf(DiscountType).default('PERCENTAGE'),
  discountValue: z.number().int().min(1).max(1_000_00),
  currency: z.enum(['EUR', 'USD', 'GBP']).default('EUR'),
  maxRedemptions: z.number().int().min(1).max(1_000_000).nullish(),
  maxRedemptionsPerUser: z.number().int().min(1).max(100).default(1),
  minPurchaseCents: z.number().int().min(0).max(10_000_00).default(0),
  applicableProducts: z.array(nativeEnumOf(ProductCode)).default([]),
  applicablePlanIds: z.array(idSchema).default([]),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().nullish(),
  isActive: z.boolean().default(true),
});

export const upsertPromotionSchema = z.object({
  title: z.string().min(2).max(120),
  subtitle: z.string().max(160).nullish(),
  body: z.string().max(500).nullish(),
  imageUrl: z.string().url().max(500).nullish(),
  ctaLabel: z.string().max(40).nullish(),
  ctaUrl: z.string().url().max(500).nullish(),
  deepLink: z.string().max(200).nullish(),
  badge: nativeEnumOf(PromoBadge).default('NONE'),
  audience: nativeEnumOf(PromotionAudience).default('ALL'),
  product: nativeEnumOf(ProductCode).nullish(),
  planId: idSchema.nullish(),
  locale: z.enum(['de', 'en']).nullish(),
  gradientFrom: z.string().max(9).nullish(),
  gradientTo: z.string().max(9).nullish(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().nullish(),
  priority: z.number().int().min(0).max(999).default(100),
  isActive: z.boolean().default(true),
});

// ── checkout ─────────────────────────────────────────────────────────────────

export const checkoutSchema = z.object({
  planId: idSchema.optional(),
  fixOddsPlanId: idSchema.optional(),
  couponCode: z.string().min(3).max(32).optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export const validateCouponSchema = z.object({
  code: z.string().min(3).max(32),
  planId: idSchema.optional(),
  fixOddsPlanId: idSchema.optional(),
});

export const verifyStorePurchaseSchema = z.object({
  provider: z.enum(['APPLE', 'GOOGLE']),
  /** iOS: the StoreKit 2 JWS transaction. Android: the purchase token. */
  receipt: z.string().min(10).max(20000),
  productId: z.string().min(1).max(120),
  /** Android only. */
  packageName: z.string().max(120).optional(),
});
export type VerifyStorePurchaseInput = z.infer<typeof verifyStorePurchaseSchema>;

export const cancelSubscriptionSchema = z.object({
  subscriptionId: idSchema,
  immediate: z.boolean().default(false),
  reason: z.string().max(200).optional(),
});

// ── polls ────────────────────────────────────────────────────────────────────

export const upsertPollSchema = z.object({
  question: z.string().min(4).max(200),
  description: z.string().max(500).nullish(),
  kind: nativeEnumOf(PollKind).default('CUSTOM'),
  status: nativeEnumOf(PollStatus).default('DRAFT'),
  product: nativeEnumOf(ProductCode).nullish(),
  eventId: idSchema.nullish(),
  imageUrl: z.string().url().max(500).nullish(),
  allowMultiple: z.boolean().default(false),
  showResultsBeforeVote: z.boolean().default(false),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().nullish(),
  options: z
    .array(
      z.object({
        id: idSchema.optional(),
        label: z.string().min(1).max(80),
        imageUrl: z.string().url().nullish(),
      }),
    )
    .min(2)
    .max(10),
});

export const voteSchema = z.object({ optionIds: z.array(idSchema).min(1).max(10) });

// ── notifications (admin) ────────────────────────────────────────────────────

export const sendNotificationSchema = z.object({
  type: nativeEnumOf(NotificationType).default('SYSTEM'),
  title: z.string().min(2).max(80),
  body: z.string().min(2).max(240),
  imageUrl: z.string().url().max(500).nullish(),
  deepLink: z.string().max(200).nullish(),
  data: z.record(z.string(), z.unknown()).default({}),
  audience: z
    .object({
      products: z.array(nativeEnumOf(ProductCode)).optional(),
      userIds: z.array(idSchema).max(1000).optional(),
      onlyFreeUsers: z.boolean().optional(),
    })
    .default({}),
  scheduledAt: z.string().datetime().nullish(),
});

// ── admin: users ─────────────────────────────────────────────────────────────

export const adminUsersQuerySchema = paginationSchema.extend({
  search: z.string().max(120).optional(),
  role: nativeEnumOf(UserRole).optional(),
  status: nativeEnumOf(UserStatus).optional(),
  product: nativeEnumOf(ProductCode).optional(),
  hasSubscription: z.coerce.boolean().optional(),
  sortBy: z.enum(['createdAt', 'lastLoginAt', 'email']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export const updateUserSchema = z.object({
  role: nativeEnumOf(UserRole).optional(),
  status: nativeEnumOf(UserStatus).optional(),
  displayName: z.string().max(60).nullish(),
  banReason: z.string().max(200).nullish(),
});

export const grantEntitlementSchema = z.object({
  product: nativeEnumOf(ProductCode),
  days: z.number().int().min(1).max(3650).optional(),
  expiresAt: z.string().datetime().nullish(),
  source: nativeEnumOf(EntitlementSource).default('ADMIN_GRANT'),
  note: z.string().max(200).optional(),
});

export const revokeEntitlementSchema = z.object({
  product: nativeEnumOf(ProductCode),
  note: z.string().max(200).optional(),
});

// ── admin: providers / settings ──────────────────────────────────────────────

export const upsertApiProviderSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(60),
  kind: z.enum(['SPORTS', 'ODDS', 'PAYMENT', 'PUSH', 'EMAIL']).default('SPORTS'),
  baseUrl: z.string().url().max(300).nullish(),
  /** Plaintext on the way in; encrypted at rest and never returned. */
  apiKey: z.string().max(500).nullish(),
  isActive: z.boolean().default(false),
  priority: z.number().int().min(0).max(999).default(100),
  pollIntervalSeconds: z.number().int().min(10).max(86400).default(120),
  rateLimitPerMinute: z.number().int().min(1).max(10000).default(60),
  enabledSports: z.array(z.string().max(32)).max(30).default([]),
  enabledLeagueIds: z.array(idSchema).max(500).default([]),
  config: z.record(z.string(), z.unknown()).default({}),
});

export const updateSettingsSchema = z.object({
  key: z.string().min(2).max(60),
  value: z.unknown(),
});

export const referralProgramSchema = z.object({
  rewardType: z.enum(['FREE_DAYS', 'CREDIT', 'DISCOUNT_COUPON']).default('FREE_DAYS'),
  rewardDays: z.number().int().min(0).max(365).default(7),
  rewardAmountCents: z.number().int().min(0).max(100_00).default(0),
  minPurchaseCents: z.number().int().min(0).max(1_000_00).default(0),
  expiresInDays: z.number().int().min(1).max(365).default(90),
  isActive: z.boolean().default(true),
});
export type ReferralProgramConfig = z.infer<typeof referralProgramSchema>;

// ── analytics ────────────────────────────────────────────────────────────────

export const ANALYTICS_EVENTS = [
  'app_open',
  'tip_view',
  'premium_view',
  'subscription_view',
  'checkout_started',
  'subscription_started',
  'notification_opened',
  'poll_vote',
  'combo_view',
  'fix_odds_view',
  'paywall_view',
  'paywall_dismissed',
  'register_completed',
  'login_completed',
  'share_clicked',
] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export const trackEventSchema = z.object({
  name: z.enum(ANALYTICS_EVENTS),
  properties: z.record(z.string(), z.unknown()).default({}),
  anonymousId: z.string().max(64).optional(),
  platform: z.enum(['ios', 'android', 'web']).optional(),
  appVersion: z.string().max(24).optional(),
  locale: z.string().max(8).optional(),
});

export const trackBatchSchema = z.object({
  events: z.array(trackEventSchema).min(1).max(50),
});

// ── webhooks ─────────────────────────────────────────────────────────────────

export const providerSchema = nativeEnumOf(PaymentProvider);
