/**
 * Domain enums.
 *
 * These mirror the Prisma enums 1:1 but live in a dependency-free package so
 * that the web, admin and mobile clients can use them without pulling in the
 * Prisma runtime. `packages/database/src/enum-parity.test.ts` asserts that the
 * two lists never drift apart.
 */

export const UserRole = {
  USER: 'USER',
  MODERATOR: 'MODERATOR',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/** Ordered from least to most privileged — used for `>=` role checks. */
export const ROLE_RANK: Record<UserRole, number> = {
  USER: 0,
  MODERATOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export const UserStatus = {
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  ACTIVE: 'ACTIVE',
  BANNED: 'BANNED',
  DELETED: 'DELETED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const AuthProvider = {
  PASSWORD: 'PASSWORD',
  GOOGLE: 'GOOGLE',
  APPLE: 'APPLE',
} as const;
export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];

export const ProductCode = {
  FREE: 'FREE',
  VIP: 'VIP',
  EXTRA: 'EXTRA',
  COMBO: 'COMBO',
  FIX_ODDS: 'FIX_ODDS',
} as const;
export type ProductCode = (typeof ProductCode)[keyof typeof ProductCode];

export const EventStatus = {
  SCHEDULED: 'SCHEDULED',
  LIVE: 'LIVE',
  HALFTIME: 'HALFTIME',
  FINISHED: 'FINISHED',
  POSTPONED: 'POSTPONED',
  CANCELLED: 'CANCELLED',
  ABANDONED: 'ABANDONED',
} as const;
export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];

export const MarketType = {
  MATCH_WINNER: 'MATCH_WINNER',
  DOUBLE_CHANCE: 'DOUBLE_CHANCE',
  DRAW_NO_BET: 'DRAW_NO_BET',
  OVER_UNDER: 'OVER_UNDER',
  TEAM_TOTAL: 'TEAM_TOTAL',
  ASIAN_HANDICAP: 'ASIAN_HANDICAP',
  EUROPEAN_HANDICAP: 'EUROPEAN_HANDICAP',
  BTTS: 'BTTS',
  CORRECT_SCORE: 'CORRECT_SCORE',
  HT_FT: 'HT_FT',
  HALF_OVER_UNDER: 'HALF_OVER_UNDER',
  CORNERS: 'CORNERS',
  CARDS: 'CARDS',
  PLAYER_PROP: 'PLAYER_PROP',
  OTHER: 'OTHER',
} as const;
export type MarketType = (typeof MarketType)[keyof typeof MarketType];

export const OddsMovement = {
  STABLE: 'STABLE',
  UP: 'UP',
  DOWN: 'DOWN',
  SIGNIFICANT_UP: 'SIGNIFICANT_UP',
  SIGNIFICANT_DOWN: 'SIGNIFICANT_DOWN',
} as const;
export type OddsMovement = (typeof OddsMovement)[keyof typeof OddsMovement];

export const TipStatus = {
  DRAFT: 'DRAFT',
  SCHEDULED: 'SCHEDULED',
  PUBLISHED: 'PUBLISHED',
  CANCELLED: 'CANCELLED',
} as const;
export type TipStatus = (typeof TipStatus)[keyof typeof TipStatus];

export const TipOutcome = {
  PENDING: 'PENDING',
  LIVE: 'LIVE',
  WON: 'WON',
  LOST: 'LOST',
  VOID: 'VOID',
  HALF_WON: 'HALF_WON',
  HALF_LOST: 'HALF_LOST',
} as const;
export type TipOutcome = (typeof TipOutcome)[keyof typeof TipOutcome];

/** Outcomes that represent a finished, countable settlement. */
export const SETTLED_OUTCOMES: TipOutcome[] = ['WON', 'LOST', 'VOID', 'HALF_WON', 'HALF_LOST'];

export const ConfidenceBand = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  VERY_HIGH: 'VERY_HIGH',
} as const;
export type ConfidenceBand = (typeof ConfidenceBand)[keyof typeof ConfidenceBand];

export const BillingInterval = {
  DAY: 'DAY',
  WEEK: 'WEEK',
  MONTH: 'MONTH',
  YEAR: 'YEAR',
  ONE_TIME: 'ONE_TIME',
} as const;
export type BillingInterval = (typeof BillingInterval)[keyof typeof BillingInterval];

export const PromoBadge = {
  NONE: 'NONE',
  MOST_POPULAR: 'MOST_POPULAR',
  LIMITED: 'LIMITED',
  SALE: 'SALE',
  NEW: 'NEW',
  BEST_VALUE: 'BEST_VALUE',
} as const;
export type PromoBadge = (typeof PromoBadge)[keyof typeof PromoBadge];

export const PaymentProvider = {
  STRIPE: 'STRIPE',
  APPLE: 'APPLE',
  GOOGLE: 'GOOGLE',
  MANUAL: 'MANUAL',
} as const;
export type PaymentProvider = (typeof PaymentProvider)[keyof typeof PaymentProvider];

export const SubscriptionStatus = {
  INCOMPLETE: 'INCOMPLETE',
  TRIALING: 'TRIALING',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  GRACE_PERIOD: 'GRACE_PERIOD',
  PAUSED: 'PAUSED',
  CANCELED: 'CANCELED',
  EXPIRED: 'EXPIRED',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

/** Statuses that still grant access to premium content. */
export const ACCESS_GRANTING_STATUSES: SubscriptionStatus[] = [
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'GRACE_PERIOD',
  'CANCELED', // cancelled but paid until currentPeriodEnd
];

export const PaymentStatus = {
  PENDING: 'PENDING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  DISPUTED: 'DISPUTED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const InvoiceStatus = {
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  PAID: 'PAID',
  VOID: 'VOID',
  UNCOLLECTIBLE: 'UNCOLLECTIBLE',
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const EntitlementSource = {
  SUBSCRIPTION: 'SUBSCRIPTION',
  ADMIN_GRANT: 'ADMIN_GRANT',
  PROMOTION: 'PROMOTION',
  REFERRAL_REWARD: 'REFERRAL_REWARD',
  TRIAL: 'TRIAL',
} as const;
export type EntitlementSource = (typeof EntitlementSource)[keyof typeof EntitlementSource];

export const DiscountType = { PERCENTAGE: 'PERCENTAGE', FIXED: 'FIXED' } as const;
export type DiscountType = (typeof DiscountType)[keyof typeof DiscountType];

export const PromotionAudience = {
  ALL: 'ALL',
  ANONYMOUS: 'ANONYMOUS',
  FREE_USERS: 'FREE_USERS',
  SUBSCRIBERS: 'SUBSCRIBERS',
  EXPIRING_SUBSCRIBERS: 'EXPIRING_SUBSCRIBERS',
  CHURNED: 'CHURNED',
} as const;
export type PromotionAudience = (typeof PromotionAudience)[keyof typeof PromotionAudience];

export const NotificationType = {
  NEW_TIP: 'NEW_TIP',
  NEW_VIP_TIP: 'NEW_VIP_TIP',
  NEW_COMBO: 'NEW_COMBO',
  NEW_EXTRA: 'NEW_EXTRA',
  NEW_FIX_ODDS: 'NEW_FIX_ODDS',
  TIP_RESULT: 'TIP_RESULT',
  KICKOFF_REMINDER: 'KICKOFF_REMINDER',
  SUBSCRIPTION_EXPIRING: 'SUBSCRIPTION_EXPIRING',
  SUBSCRIPTION_RENEWED: 'SUBSCRIPTION_RENEWED',
  SUBSCRIPTION_CANCELED: 'SUBSCRIPTION_CANCELED',
  PROMOTION: 'PROMOTION',
  POLL: 'POLL',
  SYSTEM: 'SYSTEM',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const NotificationStatus = {
  PENDING: 'PENDING',
  SCHEDULED: 'SCHEDULED',
  SENT: 'SENT',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

export const DevicePlatform = { IOS: 'IOS', ANDROID: 'ANDROID', WEB: 'WEB' } as const;
export type DevicePlatform = (typeof DevicePlatform)[keyof typeof DevicePlatform];

export const PushProvider = {
  EXPO: 'EXPO',
  FCM: 'FCM',
  APNS: 'APNS',
  WEB_PUSH: 'WEB_PUSH',
} as const;
export type PushProvider = (typeof PushProvider)[keyof typeof PushProvider];

export const PollStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type PollStatus = (typeof PollStatus)[keyof typeof PollStatus];

export const PollKind = {
  MATCH_WINNER: 'MATCH_WINNER',
  GOALS: 'GOALS',
  PLAYER_PERFORMANCE: 'PLAYER_PERFORMANCE',
  LEAGUE: 'LEAGUE',
  BEST_TIP: 'BEST_TIP',
  CUSTOM: 'CUSTOM',
} as const;
export type PollKind = (typeof PollKind)[keyof typeof PollKind];

export const ReferralStatus = {
  PENDING: 'PENDING',
  QUALIFIED: 'QUALIFIED',
  REWARDED: 'REWARDED',
  EXPIRED: 'EXPIRED',
  REJECTED: 'REJECTED',
} as const;
export type ReferralStatus = (typeof ReferralStatus)[keyof typeof ReferralStatus];

export const ReferralRewardType = {
  FREE_DAYS: 'FREE_DAYS',
  CREDIT: 'CREDIT',
  DISCOUNT_COUPON: 'DISCOUNT_COUPON',
} as const;
export type ReferralRewardType = (typeof ReferralRewardType)[keyof typeof ReferralRewardType];

export const RewardStatus = {
  PENDING: 'PENDING',
  GRANTED: 'GRANTED',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
} as const;
export type RewardStatus = (typeof RewardStatus)[keyof typeof RewardStatus];

export const ApiProviderKind = {
  SPORTS: 'SPORTS',
  ODDS: 'ODDS',
  PAYMENT: 'PAYMENT',
  PUSH: 'PUSH',
  EMAIL: 'EMAIL',
} as const;
export type ApiProviderKind = (typeof ApiProviderKind)[keyof typeof ApiProviderKind];

export const WebhookStatus = {
  RECEIVED: 'RECEIVED',
  PROCESSING: 'PROCESSING',
  PROCESSED: 'PROCESSED',
  FAILED: 'FAILED',
  IGNORED: 'IGNORED',
} as const;
export type WebhookStatus = (typeof WebhookStatus)[keyof typeof WebhookStatus];

export const StatsWindow = {
  D7: 'D7',
  D30: 'D30',
  D90: 'D90',
  M6: 'M6',
  M12: 'M12',
  ALL: 'ALL',
} as const;
export type StatsWindow = (typeof StatsWindow)[keyof typeof StatsWindow];

export const VerificationTokenType = {
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
  EMAIL_CHANGE: 'EMAIL_CHANGE',
} as const;
export type VerificationTokenType =
  (typeof VerificationTokenType)[keyof typeof VerificationTokenType];
