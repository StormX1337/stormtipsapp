import type {
  PaymentProvider,
  PaymentStatus,
  ProductCode,
  SubscriptionStatus,
} from '@profit-tips/types';

/**
 * Provider-agnostic subscription shape.
 *
 * Stripe, Apple and Google all converge on
 * `(provider, providerSubscriptionId) → status + currentPeriodEnd + autoRenew`,
 * so every adapter returns this and the rest of the platform never branches on
 * the payment provider.
 */
export interface NormalizedSubscription {
  provider: PaymentProvider;
  providerSubscriptionId: string;
  providerCustomerId: string | null;
  /** The vendor's own status string, stored verbatim for audit/debugging. */
  providerStatus: string;
  status: SubscriptionStatus;
  /** Vendor product identifier (Stripe price id, Apple/Google product id). */
  providerProductId: string | null;
  startedAt: Date;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
  gracePeriodEndsAt: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  endedAt: Date | null;
  priceCents: number | null;
  currency: string | null;
  /** Present when the vendor identifies our user (Stripe metadata, Apple/Google appAccountToken). */
  userRef: string | null;
  raw: unknown;
}

export interface NormalizedPayment {
  provider: PaymentProvider;
  providerPaymentId: string;
  providerSubscriptionId: string | null;
  providerStatus: string;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
  description: string | null;
  paidAt: Date | null;
  userRef: string | null;
  raw: unknown;
}

/** A verified, de-duplicated inbound webhook. */
export interface NormalizedWebhookEvent {
  provider: PaymentProvider;
  /** Stable vendor event id — the idempotency key. */
  eventId: string;
  type: string;
  subscription: NormalizedSubscription | null;
  payment: NormalizedPayment | null;
  raw: unknown;
}

export interface CheckoutParams {
  userId: string;
  userEmail: string;
  planSlug: string;
  providerPriceId: string;
  quantity?: number;
  trialDays?: number;
  couponCode?: string;
  successUrl: string;
  cancelUrl: string;
  locale?: string;
  currency?: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSession {
  id: string;
  url: string;
  provider: PaymentProvider;
  expiresAt: Date | null;
}

export interface StoreVerificationInput {
  /** iOS: signed StoreKit 2 JWS transaction. Android: the purchase token. */
  receipt: string;
  productId: string;
  packageName?: string;
  userId: string;
}

/** Which products a vendor product identifier unlocks. */
export type ProductResolver = (providerProductId: string) => ProductCode[] | Promise<ProductCode[]>;
