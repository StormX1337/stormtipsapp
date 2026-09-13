import type {
  BillingInterval,
  ConfidenceBand,
  DevicePlatform,
  EventStatus,
  MarketType,
  NotificationType,
  OddsMovement,
  PaymentProvider,
  PaymentStatus,
  PollKind,
  PollStatus,
  ProductCode,
  PromoBadge,
  PromotionAudience,
  ReferralStatus,
  StatsWindow,
  SubscriptionStatus,
  TipOutcome,
  TipStatus,
  UserRole,
  UserStatus,
} from './enums.js';

// ── primitives ───────────────────────────────────────────────────────────────

export interface Money {
  /** Amount in minor units (cents). */
  amountCents: number;
  currency: string;
  /** Pre-formatted for the requesting locale, e.g. "29,99 €". */
  formatted: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

// ── catalogue ────────────────────────────────────────────────────────────────

export interface SportDTO {
  id: string;
  key: string;
  name: string;
  icon: string | null;
}

export interface CountryDTO {
  id: string;
  code: string;
  name: string;
  flagEmoji: string | null;
  flagUrl: string | null;
}

export interface LeagueDTO {
  id: string;
  key: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  sport: SportDTO;
  country: CountryDTO | null;
  priority: number;
}

export interface TeamDTO {
  id: string;
  name: string;
  shortName: string | null;
  code: string | null;
  logoUrl: string | null;
  colorPrimary: string | null;
}

export interface EventDTO {
  id: string;
  startsAt: string;
  status: EventStatus;
  minute: number | null;
  period: string | null;
  homeScore: number | null;
  awayScore: number | null;
  htHomeScore: number | null;
  htAwayScore: number | null;
  homeRedCards: number | null;
  awayRedCards: number | null;
  venue: string | null;
  round: string | null;
  homeTeam: TeamDTO;
  awayTeam: TeamDTO;
  league: LeagueDTO;
}

export interface BookmakerDTO {
  id: string;
  key: string;
  name: string;
  logoUrl: string | null;
  color: string | null;
  website: string | null;
}

export interface OddDTO {
  id: string;
  bookmaker: BookmakerDTO;
  marketType: MarketType;
  selection: string;
  line: number;
  price: number;
  openingPrice: number;
  closingPrice: number | null;
  movement: OddsMovement;
  isSuspended: boolean;
  lastUpdate: string;
}

// ── tips ─────────────────────────────────────────────────────────────────────

export interface TipResultDTO {
  outcome: TipOutcome;
  returnFactor: number;
  stake: number;
  profit: number;
  homeScore: number | null;
  awayScore: number | null;
  settledAt: string;
  note: string | null;
}

export interface TipDTO {
  id: string;
  product: ProductCode;
  status: TipStatus;
  outcome: TipOutcome;
  isLive: boolean;
  /** True when the viewer lacks the entitlement; premium fields are masked. */
  isLocked: boolean;

  sport: SportDTO;
  country: CountryDTO | null;
  league: LeagueDTO;
  event: EventDTO;
  bookmaker: BookmakerDTO | null;

  marketType: MarketType;
  marketName: string;
  selectionLabel: string | null;
  selectionKey: string | null;
  line: number | null;

  odds: number | null;
  originalOdds: number | null;
  currentOdds: number | null;
  oddsChanged: boolean;
  stake: number;

  confidence: number | null;
  confidenceBand: ConfidenceBand | null;

  title: string | null;
  analysis: string | null;
  imageUrl: string | null;
  tags: string[];

  publishAt: string | null;
  expiresAt: string | null;
  settledAt: string | null;
  createdAt: string;

  result: TipResultDTO | null;
}

/** Tips grouped under a league header, exactly how the feed is rendered. */
export interface TipFeedGroupDTO {
  league: LeagueDTO;
  bookmaker: BookmakerDTO | null;
  tips: TipDTO[];
}

export interface TipFeedDTO {
  date: string;
  product: ProductCode;
  groups: TipFeedGroupDTO[];
  totalTips: number;
  lockedTips: number;
}

export interface ComboDTO {
  id: string;
  title: string;
  subtitle: string | null;
  product: ProductCode;
  status: TipStatus;
  outcome: TipOutcome;
  isLocked: boolean;
  totalOdds: number | null;
  stake: number;
  potentialReturn: number | null;
  profit: number | null;
  analysis: string | null;
  publishAt: string | null;
  settledAt: string | null;
  items: TipDTO[];
}

// ── statistics ───────────────────────────────────────────────────────────────

export interface StatisticsBucketDTO {
  key: string;
  label: string;
  tips: number;
  won: number;
  lost: number;
  profit: number;
  roi: number;
  winRate: number;
  avgOdds: number;
}

export interface StatisticsSeriesPointDTO {
  date: string;
  profit: number;
  cumulativeProfit: number;
  tips: number;
  won: number;
  lost: number;
}

export interface StatisticsDTO {
  product: ProductCode | 'ALL';
  window: StatsWindow;
  periodStart: string;
  periodEnd: string;
  /** Number of days the window actually covers (used for "Last N days" copy). */
  days: number;

  totalTips: number;
  settledTips: number;
  pendingTips: number;
  won: number;
  lost: number;
  void: number;
  halfWon: number;
  halfLost: number;

  winRate: number;
  /** Profit ÷ turnover × 100 — the classic betting ROI / yield. */
  roi: number;
  yield: number;
  /**
   * Profit expressed as a multiple of a single flat stake × 100.
   * This is the "Return on purchase" headline shown on the Combo paywall.
   */
  returnOnStake: number;
  avgOdds: number;
  avgStake: number;
  totalStake: number;
  profit: number;

  bestStreak: number;
  worstStreak: number;
  currentStreak: number;

  byDay: StatisticsSeriesPointDTO[];
  byWeek: StatisticsSeriesPointDTO[];
  byMonth: StatisticsSeriesPointDTO[];
  byLeague: StatisticsBucketDTO[];
  byMarket: StatisticsBucketDTO[];
  byProduct: StatisticsBucketDTO[];
}

// ── commerce ─────────────────────────────────────────────────────────────────

export interface ProductDTO {
  code: ProductCode;
  name: string;
  tagline: string | null;
  description: string | null;
  icon: string | null;
  color: string | null;
  benefits: string[];
}

export interface SubscriptionPlanDTO {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  products: ProductCode[];
  price: Money;
  compareAtPrice: Money | null;
  /** Price divided by the number of months — drives the "per month" ribbon. */
  pricePerMonth: Money | null;
  savingsPercent: number | null;
  savings: Money | null;
  interval: BillingInterval;
  intervalCount: number;
  months: number;
  trialDays: number;
  badge: PromoBadge;
  highlight: string | null;
  isPopular: boolean;
  stripePriceId: string | null;
  appleProductId: string | null;
  googleProductId: string | null;
}

export interface FixOddsPlanDTO {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: Money;
  interval: BillingInterval;
  intervalCount: number;
  targetOdds: number;
  maxOdds: number;
  minConfidence: number;
  picksPerPeriod: number;
  sportIds: string[];
  leagueIds: string[];
  allowLive: boolean;
  requiresVip: boolean;
  badge: PromoBadge;
}

export interface EntitlementDTO {
  product: ProductCode;
  active: boolean;
  source: string;
  expiresAt: string | null;
}

export interface SubscriptionDTO {
  id: string;
  status: SubscriptionStatus;
  provider: PaymentProvider;
  products: ProductCode[];
  plan: SubscriptionPlanDTO | null;
  startedAt: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  willRenew: boolean;
  daysRemaining: number | null;
}

export interface PaymentDTO {
  id: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: Money;
  refunded: Money;
  description: string | null;
  paidAt: string | null;
  createdAt: string;
  invoiceNumber: string | null;
  invoiceUrl: string | null;
}

export interface CouponPreviewDTO {
  code: string;
  valid: boolean;
  reason?: string;
  discountCents: number;
  finalPriceCents: number;
  currency: string;
}

export interface PromotionDTO {
  id: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  deepLink: string | null;
  badge: PromoBadge;
  audience: PromotionAudience;
  product: ProductCode | null;
  planId: string | null;
  gradientFrom: string | null;
  gradientTo: string | null;
  endsAt: string | null;
}

// ── user ─────────────────────────────────────────────────────────────────────

export interface NotificationPreferences {
  newTips: boolean;
  vipTips: boolean;
  comboTips: boolean;
  extraTips: boolean;
  fixOddsTips: boolean;
  results: boolean;
  kickoffReminders: boolean;
  subscription: boolean;
  promotions: boolean;
  polls: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  newTips: true,
  vipTips: true,
  comboTips: true,
  extraTips: true,
  fixOddsTips: true,
  results: true,
  kickoffReminders: true,
  subscription: true,
  promotions: false,
  polls: false,
};

export interface UserDTO {
  id: string;
  email: string;
  emailVerified: boolean;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  countryCode: string | null;
  language: string;
  timezone: string;
  currency: string;
  marketingOptIn: boolean;
  notificationPrefs: NotificationPreferences;
  favoriteLeagueIds: string[];
  favoriteTeamIds: string[];
  referralCode: string;
  createdAt: string;
  entitlements: EntitlementDTO[];
}

export interface AuthTokensDTO {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface AuthResponseDTO {
  user: UserDTO;
  tokens: AuthTokensDTO;
}

export interface DeviceTokenDTO {
  id: string;
  platform: DevicePlatform;
  provider: string;
  isActive: boolean;
  lastSeenAt: string;
}

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  imageUrl: string | null;
  deepLink: string | null;
  data: Record<string, unknown>;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

// ── polls ────────────────────────────────────────────────────────────────────

export interface PollOptionDTO {
  id: string;
  label: string;
  imageUrl: string | null;
  voteCount: number;
  percentage: number;
  isMyVote: boolean;
}

export interface PollDTO {
  id: string;
  question: string;
  description: string | null;
  kind: PollKind;
  status: PollStatus;
  imageUrl: string | null;
  allowMultiple: boolean;
  totalVotes: number;
  hasVoted: boolean;
  showResults: boolean;
  startsAt: string;
  endsAt: string | null;
  event: EventDTO | null;
  options: PollOptionDTO[];
}

// ── referrals ────────────────────────────────────────────────────────────────

export interface ReferralSummaryDTO {
  code: string;
  link: string;
  totalReferrals: number;
  qualifiedReferrals: number;
  rewardedReferrals: number;
  pendingReferrals: number;
  rewards: {
    id: string;
    type: string;
    status: string;
    days: number | null;
    amount: Money | null;
    grantedAt: string | null;
  }[];
  program: {
    rewardType: string;
    rewardDays: number;
    rewardAmountCents: number;
    minPurchaseCents: number;
    expiresInDays: number;
  };
}

export interface ReferralDTO {
  id: string;
  status: ReferralStatus;
  refereeMasked: string;
  createdAt: string;
  qualifiedAt: string | null;
}

// ── admin ────────────────────────────────────────────────────────────────────

export interface AdminDashboardDTO {
  revenue: { today: Money; month: Money; total: Money; mrr: Money };
  users: {
    total: number;
    active30d: number;
    newToday: number;
    new30d: number;
    banned: number;
  };
  subscribers: {
    total: number;
    byProduct: Record<ProductCode, number>;
    trialing: number;
    cancelledThisMonth: number;
    conversionRate: number;
    churnRate: number;
  };
  tips: {
    published: number;
    won: number;
    lost: number;
    pending: number;
    roi: number;
    avgOdds: number;
    winRate: number;
  };
  charts: {
    revenueByDay: { date: string; amountCents: number }[];
    signupsByDay: { date: string; count: number }[];
    profitByDay: StatisticsSeriesPointDTO[];
  };
}

export interface AuditLogDTO {
  id: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
}
