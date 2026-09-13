-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'BANNED', 'DELETED');

-- CreateEnum
CREATE TYPE "public"."AuthProvider" AS ENUM ('PASSWORD', 'GOOGLE', 'APPLE');

-- CreateEnum
CREATE TYPE "public"."VerificationTokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'EMAIL_CHANGE');

-- CreateEnum
CREATE TYPE "public"."ProductCode" AS ENUM ('FREE', 'VIP', 'EXTRA', 'COMBO', 'FIX_ODDS');

-- CreateEnum
CREATE TYPE "public"."EventStatus" AS ENUM ('SCHEDULED', 'LIVE', 'HALFTIME', 'FINISHED', 'POSTPONED', 'CANCELLED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "public"."MarketType" AS ENUM ('MATCH_WINNER', 'DOUBLE_CHANCE', 'DRAW_NO_BET', 'OVER_UNDER', 'TEAM_TOTAL', 'ASIAN_HANDICAP', 'EUROPEAN_HANDICAP', 'BTTS', 'CORRECT_SCORE', 'HT_FT', 'HALF_OVER_UNDER', 'CORNERS', 'CARDS', 'PLAYER_PROP', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."OddsMovement" AS ENUM ('STABLE', 'UP', 'DOWN', 'SIGNIFICANT_UP', 'SIGNIFICANT_DOWN');

-- CreateEnum
CREATE TYPE "public"."TipStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."TipOutcome" AS ENUM ('PENDING', 'LIVE', 'WON', 'LOST', 'VOID', 'HALF_WON', 'HALF_LOST');

-- CreateEnum
CREATE TYPE "public"."ConfidenceBand" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "public"."BillingInterval" AS ENUM ('DAY', 'WEEK', 'MONTH', 'YEAR', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "public"."PromoBadge" AS ENUM ('NONE', 'MOST_POPULAR', 'LIMITED', 'SALE', 'NEW', 'BEST_VALUE');

-- CreateEnum
CREATE TYPE "public"."PaymentProvider" AS ENUM ('STRIPE', 'APPLE', 'GOOGLE', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('INCOMPLETE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'PAUSED', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "public"."InvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "public"."EntitlementSource" AS ENUM ('SUBSCRIPTION', 'ADMIN_GRANT', 'PROMOTION', 'REFERRAL_REWARD', 'TRIAL');

-- CreateEnum
CREATE TYPE "public"."DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "public"."PromotionAudience" AS ENUM ('ALL', 'ANONYMOUS', 'FREE_USERS', 'SUBSCRIBERS', 'EXPIRING_SUBSCRIBERS', 'CHURNED');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('NEW_TIP', 'NEW_VIP_TIP', 'NEW_COMBO', 'NEW_EXTRA', 'NEW_FIX_ODDS', 'TIP_RESULT', 'KICKOFF_REMINDER', 'SUBSCRIPTION_EXPIRING', 'SUBSCRIPTION_RENEWED', 'SUBSCRIPTION_CANCELED', 'PROMOTION', 'POLL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."NotificationStatus" AS ENUM ('PENDING', 'SCHEDULED', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."DevicePlatform" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateEnum
CREATE TYPE "public"."PushProvider" AS ENUM ('EXPO', 'FCM', 'APNS', 'WEB_PUSH');

-- CreateEnum
CREATE TYPE "public"."PollStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."PollKind" AS ENUM ('MATCH_WINNER', 'GOALS', 'PLAYER_PERFORMANCE', 'LEAGUE', 'BEST_TIP', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."ReferralStatus" AS ENUM ('PENDING', 'QUALIFIED', 'REWARDED', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."ReferralRewardType" AS ENUM ('FREE_DAYS', 'CREDIT', 'DISCOUNT_COUPON');

-- CreateEnum
CREATE TYPE "public"."RewardStatus" AS ENUM ('PENDING', 'GRANTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."ApiProviderKind" AS ENUM ('SPORTS', 'ODDS', 'PAYMENT', 'PUSH', 'EMAIL');

-- CreateEnum
CREATE TYPE "public"."WebhookStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "public"."StatsWindow" AS ENUM ('D7', 'D30', 'D90', 'M6', 'M12', 'ALL');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT,
    "username" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'USER',
    "status" "public"."UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "authProviders" "public"."AuthProvider"[] DEFAULT ARRAY['PASSWORD']::"public"."AuthProvider"[],
    "googleId" TEXT,
    "appleId" TEXT,
    "countryCode" VARCHAR(2),
    "language" VARCHAR(8) NOT NULL DEFAULT 'de',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Berlin',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "notificationPrefs" JSONB NOT NULL DEFAULT '{}',
    "favoriteLeagueIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "favoriteTeamIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "referralCode" TEXT NOT NULL,
    "referredById" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "bannedAt" TIMESTAMP(3),
    "banReason" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "deviceName" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "replacedByHash" TEXT,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."verification_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."VerificationTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "payload" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sports" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."countries" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "flagEmoji" TEXT,
    "flagUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."leagues" (
    "id" TEXT NOT NULL,
    "providerLeagueId" TEXT,
    "sportId" TEXT NOT NULL,
    "countryId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "logoUrl" TEXT,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "season" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."teams" (
    "id" TEXT NOT NULL,
    "providerTeamId" TEXT,
    "sportId" TEXT NOT NULL,
    "countryId" TEXT,
    "leagueId" TEXT,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "code" VARCHAR(6),
    "logoUrl" TEXT,
    "colorPrimary" VARCHAR(9),
    "colorSecondary" VARCHAR(9),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."events" (
    "id" TEXT NOT NULL,
    "providerEventId" TEXT,
    "providerSlug" TEXT,
    "sportId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "status" "public"."EventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "minute" INTEGER,
    "period" TEXT,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "htHomeScore" INTEGER,
    "htAwayScore" INTEGER,
    "homeRedCards" INTEGER,
    "awayRedCards" INTEGER,
    "homeYellowCards" INTEGER,
    "awayYellowCards" INTEGER,
    "homeCorners" INTEGER,
    "awayCorners" INTEGER,
    "venue" TEXT,
    "round" TEXT,
    "season" TEXT,
    "statistics" JSONB,
    "raw" JSONB,
    "resultSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bookmakers" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "website" TEXT,
    "color" VARCHAR(9),
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookmakers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."markets" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" "public"."MarketType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sportId" TEXT,
    "hasLine" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."odds" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "bookmakerId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "selection" TEXT NOT NULL,
    "line" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "price" DECIMAL(10,3) NOT NULL,
    "openingPrice" DECIMAL(10,3) NOT NULL,
    "closingPrice" DECIMAL(10,3),
    "movement" "public"."OddsMovement" NOT NULL DEFAULT 'STABLE',
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "lastUpdate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."odds_history" (
    "id" TEXT NOT NULL,
    "oddId" TEXT NOT NULL,
    "price" DECIMAL(10,3) NOT NULL,
    "delta" DECIMAL(10,4) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odds_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tips" (
    "id" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "countryId" TEXT,
    "leagueId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "bookmakerId" TEXT,
    "marketType" "public"."MarketType" NOT NULL,
    "selectionLabel" TEXT NOT NULL,
    "selectionKey" TEXT NOT NULL,
    "line" DECIMAL(6,2),
    "odds" DECIMAL(10,3) NOT NULL,
    "originalOdds" DECIMAL(10,3) NOT NULL,
    "currentOdds" DECIMAL(10,3),
    "oddsChanged" BOOLEAN NOT NULL DEFAULT false,
    "stake" DECIMAL(10,2) NOT NULL DEFAULT 10,
    "confidence" INTEGER NOT NULL DEFAULT 70,
    "confidenceBand" "public"."ConfidenceBand" NOT NULL DEFAULT 'MEDIUM',
    "product" "public"."ProductCode" NOT NULL DEFAULT 'FREE',
    "status" "public"."TipStatus" NOT NULL DEFAULT 'DRAFT',
    "outcome" "public"."TipOutcome" NOT NULL DEFAULT 'PENDING',
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "isStandalone" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT,
    "analysis" TEXT,
    "imageUrl" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT,
    "publishAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "createdById" TEXT,
    "fixOddsPlanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tip_results" (
    "id" TEXT NOT NULL,
    "tipId" TEXT NOT NULL,
    "outcome" "public"."TipOutcome" NOT NULL,
    "returnFactor" DECIMAL(10,4) NOT NULL,
    "stake" DECIMAL(10,2) NOT NULL,
    "profit" DECIMAL(12,2) NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "settledBy" TEXT NOT NULL DEFAULT 'ENGINE',
    "note" TEXT,
    "raw" JSONB,
    "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tip_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."combos" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "product" "public"."ProductCode" NOT NULL DEFAULT 'COMBO',
    "status" "public"."TipStatus" NOT NULL DEFAULT 'DRAFT',
    "outcome" "public"."TipOutcome" NOT NULL DEFAULT 'PENDING',
    "totalOdds" DECIMAL(12,3) NOT NULL,
    "stake" DECIMAL(10,2) NOT NULL DEFAULT 10,
    "returnFactor" DECIMAL(12,4),
    "profit" DECIMAL(12,2),
    "analysis" TEXT,
    "publishAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "combos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."combo_items" (
    "id" TEXT NOT NULL,
    "comboId" TEXT NOT NULL,
    "tipId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "combo_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."products" (
    "id" TEXT NOT NULL,
    "code" "public"."ProductCode" NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "icon" TEXT,
    "color" VARCHAR(9),
    "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subscription_plans" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "products" "public"."ProductCode"[] DEFAULT ARRAY[]::"public"."ProductCode"[],
    "priceCents" INTEGER NOT NULL,
    "compareAtPriceCents" INTEGER,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "interval" "public"."BillingInterval" NOT NULL DEFAULT 'MONTH',
    "intervalCount" INTEGER NOT NULL DEFAULT 1,
    "trialDays" INTEGER NOT NULL DEFAULT 0,
    "badge" "public"."PromoBadge" NOT NULL DEFAULT 'NONE',
    "highlight" TEXT,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "stripePriceId" TEXT,
    "stripeProductId" TEXT,
    "appleProductId" TEXT,
    "googleProductId" TEXT,
    "googleBasePlanId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fix_odds_plans" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "interval" "public"."BillingInterval" NOT NULL DEFAULT 'MONTH',
    "intervalCount" INTEGER NOT NULL DEFAULT 1,
    "targetOdds" DECIMAL(10,3) NOT NULL,
    "maxOdds" DECIMAL(10,3) NOT NULL,
    "minConfidence" INTEGER NOT NULL DEFAULT 60,
    "picksPerPeriod" INTEGER NOT NULL DEFAULT 10,
    "sportIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "leagueIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowLive" BOOLEAN NOT NULL DEFAULT false,
    "requiresVip" BOOLEAN NOT NULL DEFAULT false,
    "badge" "public"."PromoBadge" NOT NULL DEFAULT 'NONE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "stripePriceId" TEXT,
    "appleProductId" TEXT,
    "googleProductId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fix_odds_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT,
    "provider" "public"."PaymentProvider" NOT NULL,
    "providerSubscriptionId" TEXT NOT NULL,
    "providerCustomerId" TEXT,
    "providerStatus" TEXT,
    "status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "products" "public"."ProductCode"[] DEFAULT ARRAY[]::"public"."ProductCode"[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "gracePeriodEndsAt" TIMESTAMP(3),
    "priceCents" INTEGER,
    "currency" VARCHAR(3),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."entitlements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "product" "public"."ProductCode" NOT NULL,
    "source" "public"."EntitlementSource" NOT NULL DEFAULT 'SUBSCRIPTION',
    "subscriptionId" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "grantedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "provider" "public"."PaymentProvider" NOT NULL,
    "providerPaymentId" TEXT NOT NULL,
    "providerStatus" TEXT,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "description" TEXT,
    "couponId" TEXT,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."invoices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentId" TEXT,
    "subscriptionId" TEXT,
    "number" TEXT NOT NULL,
    "status" "public"."InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "amountDueCents" INTEGER NOT NULL,
    "amountPaidCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "lines" JSONB NOT NULL DEFAULT '[]',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "public"."DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    "discountValue" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "maxRedemptions" INTEGER,
    "maxRedemptionsPerUser" INTEGER NOT NULL DEFAULT 1,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "minPurchaseCents" INTEGER NOT NULL DEFAULT 0,
    "applicableProducts" "public"."ProductCode"[] DEFAULT ARRAY[]::"public"."ProductCode"[],
    "applicablePlanIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."coupon_redemptions" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentId" TEXT,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."promotions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "body" TEXT,
    "imageUrl" TEXT,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "deepLink" TEXT,
    "badge" "public"."PromoBadge" NOT NULL DEFAULT 'NONE',
    "audience" "public"."PromotionAudience" NOT NULL DEFAULT 'ALL',
    "product" "public"."ProductCode",
    "planId" TEXT,
    "locale" VARCHAR(8),
    "gradientFrom" VARCHAR(9),
    "gradientTo" VARCHAR(9),
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."webhook_events" (
    "id" TEXT NOT NULL,
    "provider" "public"."PaymentProvider" NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "public"."WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "topic" TEXT,
    "type" "public"."NotificationType" NOT NULL,
    "status" "public"."NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "deepLink" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."device_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "provider" "public"."PushProvider" NOT NULL DEFAULT 'EXPO',
    "platform" "public"."DevicePlatform" NOT NULL,
    "deviceId" TEXT,
    "deviceName" TEXT,
    "appVersion" TEXT,
    "locale" VARCHAR(8),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."polls" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "description" TEXT,
    "kind" "public"."PollKind" NOT NULL DEFAULT 'CUSTOM',
    "status" "public"."PollStatus" NOT NULL DEFAULT 'DRAFT',
    "product" "public"."ProductCode",
    "eventId" TEXT,
    "imageUrl" TEXT,
    "allowMultiple" BOOLEAN NOT NULL DEFAULT false,
    "showResultsBeforeVote" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."poll_options" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."poll_votes" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."referrals" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "status" "public"."ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "qualifiedAt" TIMESTAMP(3),
    "rewardedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."referral_rewards" (
    "id" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."ReferralRewardType" NOT NULL DEFAULT 'FREE_DAYS',
    "status" "public"."RewardStatus" NOT NULL DEFAULT 'PENDING',
    "days" INTEGER,
    "amountCents" INTEGER,
    "currency" VARCHAR(3),
    "couponId" TEXT,
    "grantedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."api_providers" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "public"."ApiProviderKind" NOT NULL DEFAULT 'SPORTS',
    "baseUrl" TEXT,
    "apiKeyEncrypted" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "pollIntervalSeconds" INTEGER NOT NULL DEFAULT 120,
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 60,
    "enabledSports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabledLeagueIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "config" JSONB NOT NULL DEFAULT '{}',
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."statistics_snapshots" (
    "id" TEXT NOT NULL,
    "product" "public"."ProductCode" NOT NULL,
    "window" "public"."StatsWindow" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalTips" INTEGER NOT NULL DEFAULT 0,
    "wonTips" INTEGER NOT NULL DEFAULT 0,
    "lostTips" INTEGER NOT NULL DEFAULT 0,
    "voidTips" INTEGER NOT NULL DEFAULT 0,
    "halfWonTips" INTEGER NOT NULL DEFAULT 0,
    "halfLostTips" INTEGER NOT NULL DEFAULT 0,
    "pendingTips" INTEGER NOT NULL DEFAULT 0,
    "winRate" DECIMAL(7,4) NOT NULL,
    "roi" DECIMAL(10,4) NOT NULL,
    "yieldPct" DECIMAL(10,4) NOT NULL,
    "avgOdds" DECIMAL(10,3) NOT NULL,
    "avgStake" DECIMAL(10,2) NOT NULL,
    "totalStake" DECIMAL(14,2) NOT NULL,
    "profit" DECIMAL(14,2) NOT NULL,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "worstStreak" INTEGER NOT NULL DEFAULT 0,
    "breakdown" JSONB NOT NULL DEFAULT '{}',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statistics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analytics_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "anonymousId" TEXT,
    "name" TEXT NOT NULL,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "platform" TEXT,
    "appVersion" TEXT,
    "locale" VARCHAR(8),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."app_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "public"."users"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "users_appleId_key" ON "public"."users"("appleId");

-- CreateIndex
CREATE UNIQUE INDEX "users_referralCode_key" ON "public"."users"("referralCode");

-- CreateIndex
CREATE INDEX "users_status_role_idx" ON "public"."users"("status", "role");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "public"."users"("createdAt");

-- CreateIndex
CREATE INDEX "users_referredById_idx" ON "public"."users"("referredById");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshTokenHash_key" ON "public"."sessions"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_revokedAt_idx" ON "public"."sessions"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "sessions_familyId_idx" ON "public"."sessions"("familyId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "public"."sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_tokenHash_key" ON "public"."verification_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "verification_tokens_userId_type_idx" ON "public"."verification_tokens"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "sports_key_key" ON "public"."sports"("key");

-- CreateIndex
CREATE UNIQUE INDEX "countries_code_key" ON "public"."countries"("code");

-- CreateIndex
CREATE INDEX "leagues_providerLeagueId_idx" ON "public"."leagues"("providerLeagueId");

-- CreateIndex
CREATE INDEX "leagues_isActive_priority_idx" ON "public"."leagues"("isActive", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "leagues_sportId_key_key" ON "public"."leagues"("sportId", "key");

-- CreateIndex
CREATE INDEX "teams_providerTeamId_idx" ON "public"."teams"("providerTeamId");

-- CreateIndex
CREATE INDEX "teams_leagueId_idx" ON "public"."teams"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "teams_sportId_name_key" ON "public"."teams"("sportId", "name");

-- CreateIndex
CREATE INDEX "events_startsAt_status_idx" ON "public"."events"("startsAt", "status");

-- CreateIndex
CREATE INDEX "events_leagueId_startsAt_idx" ON "public"."events"("leagueId", "startsAt");

-- CreateIndex
CREATE INDEX "events_status_startsAt_idx" ON "public"."events"("status", "startsAt");

-- CreateIndex
CREATE INDEX "events_providerEventId_idx" ON "public"."events"("providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "events_providerSlug_key" ON "public"."events"("providerSlug");

-- CreateIndex
CREATE UNIQUE INDEX "bookmakers_key_key" ON "public"."bookmakers"("key");

-- CreateIndex
CREATE INDEX "bookmakers_isActive_priority_idx" ON "public"."bookmakers"("isActive", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "markets_key_key" ON "public"."markets"("key");

-- CreateIndex
CREATE INDEX "markets_type_idx" ON "public"."markets"("type");

-- CreateIndex
CREATE INDEX "odds_eventId_marketId_idx" ON "public"."odds"("eventId", "marketId");

-- CreateIndex
CREATE INDEX "odds_lastUpdate_idx" ON "public"."odds"("lastUpdate");

-- CreateIndex
CREATE UNIQUE INDEX "odds_eventId_bookmakerId_marketId_selection_line_key" ON "public"."odds"("eventId", "bookmakerId", "marketId", "selection", "line");

-- CreateIndex
CREATE INDEX "odds_history_oddId_recordedAt_idx" ON "public"."odds_history"("oddId", "recordedAt");

-- CreateIndex
CREATE INDEX "tips_product_status_publishAt_idx" ON "public"."tips"("product", "status", "publishAt");

-- CreateIndex
CREATE INDEX "tips_status_outcome_idx" ON "public"."tips"("status", "outcome");

-- CreateIndex
CREATE INDEX "tips_eventId_idx" ON "public"."tips"("eventId");

-- CreateIndex
CREATE INDEX "tips_leagueId_publishAt_idx" ON "public"."tips"("leagueId", "publishAt");

-- CreateIndex
CREATE INDEX "tips_settledAt_idx" ON "public"."tips"("settledAt");

-- CreateIndex
CREATE INDEX "tips_isLive_status_idx" ON "public"."tips"("isLive", "status");

-- CreateIndex
CREATE INDEX "tips_createdById_idx" ON "public"."tips"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "tip_results_tipId_key" ON "public"."tip_results"("tipId");

-- CreateIndex
CREATE INDEX "tip_results_outcome_settledAt_idx" ON "public"."tip_results"("outcome", "settledAt");

-- CreateIndex
CREATE INDEX "combos_product_status_publishAt_idx" ON "public"."combos"("product", "status", "publishAt");

-- CreateIndex
CREATE INDEX "combos_outcome_idx" ON "public"."combos"("outcome");

-- CreateIndex
CREATE INDEX "combo_items_tipId_idx" ON "public"."combo_items"("tipId");

-- CreateIndex
CREATE UNIQUE INDEX "combo_items_comboId_tipId_key" ON "public"."combo_items"("comboId", "tipId");

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "public"."products"("code");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_slug_key" ON "public"."subscription_plans"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_stripePriceId_key" ON "public"."subscription_plans"("stripePriceId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_appleProductId_key" ON "public"."subscription_plans"("appleProductId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_googleProductId_key" ON "public"."subscription_plans"("googleProductId");

-- CreateIndex
CREATE INDEX "subscription_plans_isActive_sortOrder_idx" ON "public"."subscription_plans"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "fix_odds_plans_slug_key" ON "public"."fix_odds_plans"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "fix_odds_plans_stripePriceId_key" ON "public"."fix_odds_plans"("stripePriceId");

-- CreateIndex
CREATE UNIQUE INDEX "fix_odds_plans_appleProductId_key" ON "public"."fix_odds_plans"("appleProductId");

-- CreateIndex
CREATE UNIQUE INDEX "fix_odds_plans_googleProductId_key" ON "public"."fix_odds_plans"("googleProductId");

-- CreateIndex
CREATE INDEX "fix_odds_plans_isActive_sortOrder_idx" ON "public"."fix_odds_plans"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "subscriptions_userId_status_idx" ON "public"."subscriptions"("userId", "status");

-- CreateIndex
CREATE INDEX "subscriptions_status_currentPeriodEnd_idx" ON "public"."subscriptions"("status", "currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_provider_providerSubscriptionId_key" ON "public"."subscriptions"("provider", "providerSubscriptionId");

-- CreateIndex
CREATE INDEX "entitlements_userId_product_revokedAt_idx" ON "public"."entitlements"("userId", "product", "revokedAt");

-- CreateIndex
CREATE INDEX "entitlements_expiresAt_idx" ON "public"."entitlements"("expiresAt");

-- CreateIndex
CREATE INDEX "entitlements_subscriptionId_idx" ON "public"."entitlements"("subscriptionId");

-- CreateIndex
CREATE INDEX "payments_userId_createdAt_idx" ON "public"."payments"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "payments_status_paidAt_idx" ON "public"."payments"("status", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_providerPaymentId_key" ON "public"."payments"("provider", "providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_paymentId_key" ON "public"."invoices"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "public"."invoices"("number");

-- CreateIndex
CREATE INDEX "invoices_userId_issuedAt_idx" ON "public"."invoices"("userId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "public"."coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_isActive_validUntil_idx" ON "public"."coupons"("isActive", "validUntil");

-- CreateIndex
CREATE INDEX "coupon_redemptions_couponId_userId_idx" ON "public"."coupon_redemptions"("couponId", "userId");

-- CreateIndex
CREATE INDEX "coupon_redemptions_userId_idx" ON "public"."coupon_redemptions"("userId");

-- CreateIndex
CREATE INDEX "promotions_isActive_startsAt_endsAt_idx" ON "public"."promotions"("isActive", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "webhook_events_status_receivedAt_idx" ON "public"."webhook_events"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_eventId_key" ON "public"."webhook_events"("provider", "eventId");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "public"."notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_status_scheduledAt_idx" ON "public"."notifications"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "notifications_topic_idx" ON "public"."notifications"("topic");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_token_key" ON "public"."device_tokens"("token");

-- CreateIndex
CREATE INDEX "device_tokens_userId_isActive_idx" ON "public"."device_tokens"("userId", "isActive");

-- CreateIndex
CREATE INDEX "polls_status_startsAt_idx" ON "public"."polls"("status", "startsAt");

-- CreateIndex
CREATE INDEX "poll_options_pollId_sortOrder_idx" ON "public"."poll_options"("pollId", "sortOrder");

-- CreateIndex
CREATE INDEX "poll_votes_pollId_userId_idx" ON "public"."poll_votes"("pollId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "poll_votes_optionId_userId_key" ON "public"."poll_votes"("optionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_refereeId_key" ON "public"."referrals"("refereeId");

-- CreateIndex
CREATE INDEX "referrals_referrerId_status_idx" ON "public"."referrals"("referrerId", "status");

-- CreateIndex
CREATE INDEX "referral_rewards_userId_status_idx" ON "public"."referral_rewards"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "api_providers_slug_key" ON "public"."api_providers"("slug");

-- CreateIndex
CREATE INDEX "api_providers_kind_isActive_priority_idx" ON "public"."api_providers"("kind", "isActive", "priority");

-- CreateIndex
CREATE INDEX "statistics_snapshots_product_window_idx" ON "public"."statistics_snapshots"("product", "window");

-- CreateIndex
CREATE UNIQUE INDEX "statistics_snapshots_product_window_periodEnd_key" ON "public"."statistics_snapshots"("product", "window", "periodEnd");

-- CreateIndex
CREATE INDEX "analytics_events_name_createdAt_idx" ON "public"."analytics_events"("name", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_userId_createdAt_idx" ON "public"."analytics_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "public"."audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "public"."audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "public"."audit_logs"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."verification_tokens" ADD CONSTRAINT "verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leagues" ADD CONSTRAINT "leagues_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "public"."sports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leagues" ADD CONSTRAINT "leagues_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "public"."countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."teams" ADD CONSTRAINT "teams_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "public"."sports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."teams" ADD CONSTRAINT "teams_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "public"."countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."teams" ADD CONSTRAINT "teams_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "public"."leagues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."events" ADD CONSTRAINT "events_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "public"."sports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."events" ADD CONSTRAINT "events_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "public"."leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."events" ADD CONSTRAINT "events_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "public"."teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."events" ADD CONSTRAINT "events_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "public"."teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."markets" ADD CONSTRAINT "markets_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "public"."sports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."odds" ADD CONSTRAINT "odds_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."odds" ADD CONSTRAINT "odds_bookmakerId_fkey" FOREIGN KEY ("bookmakerId") REFERENCES "public"."bookmakers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."odds" ADD CONSTRAINT "odds_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "public"."markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."odds_history" ADD CONSTRAINT "odds_history_oddId_fkey" FOREIGN KEY ("oddId") REFERENCES "public"."odds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tips" ADD CONSTRAINT "tips_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "public"."sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tips" ADD CONSTRAINT "tips_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "public"."countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tips" ADD CONSTRAINT "tips_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "public"."leagues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tips" ADD CONSTRAINT "tips_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tips" ADD CONSTRAINT "tips_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "public"."markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tips" ADD CONSTRAINT "tips_bookmakerId_fkey" FOREIGN KEY ("bookmakerId") REFERENCES "public"."bookmakers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tips" ADD CONSTRAINT "tips_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tips" ADD CONSTRAINT "tips_fixOddsPlanId_fkey" FOREIGN KEY ("fixOddsPlanId") REFERENCES "public"."fix_odds_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tip_results" ADD CONSTRAINT "tip_results_tipId_fkey" FOREIGN KEY ("tipId") REFERENCES "public"."tips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."combos" ADD CONSTRAINT "combos_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."combo_items" ADD CONSTRAINT "combo_items_comboId_fkey" FOREIGN KEY ("comboId") REFERENCES "public"."combos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."combo_items" ADD CONSTRAINT "combo_items_tipId_fkey" FOREIGN KEY ("tipId") REFERENCES "public"."tips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."entitlements" ADD CONSTRAINT "entitlements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."entitlements" ADD CONSTRAINT "entitlements_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."entitlements" ADD CONSTRAINT "entitlements_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "public"."coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "public"."coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."promotions" ADD CONSTRAINT "promotions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."device_tokens" ADD CONSTRAINT "device_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."polls" ADD CONSTRAINT "polls_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."polls" ADD CONSTRAINT "polls_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."poll_options" ADD CONSTRAINT "poll_options_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "public"."polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."poll_votes" ADD CONSTRAINT "poll_votes_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "public"."polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."poll_votes" ADD CONSTRAINT "poll_votes_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "public"."poll_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."poll_votes" ADD CONSTRAINT "poll_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."referrals" ADD CONSTRAINT "referrals_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."referrals" ADD CONSTRAINT "referrals_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."referral_rewards" ADD CONSTRAINT "referral_rewards_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "public"."referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."referral_rewards" ADD CONSTRAINT "referral_rewards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."analytics_events" ADD CONSTRAINT "analytics_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
