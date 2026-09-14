import Stripe from 'stripe';
import { AppError, ErrorCode, type SubscriptionStatus } from '@storm-tips/types';
import type {
  CheckoutParams,
  CheckoutSession,
  NormalizedPayment,
  NormalizedSubscription,
  NormalizedWebhookEvent,
} from '../types.js';

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  apiVersion?: Stripe.LatestApiVersion;
}

/** Stripe subscription status → our provider-agnostic status. */
const STATUS_MAP: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
  incomplete: 'INCOMPLETE',
  incomplete_expired: 'EXPIRED',
  trialing: 'TRIALING',
  active: 'ACTIVE',
  past_due: 'PAST_DUE',
  canceled: 'CANCELED',
  unpaid: 'EXPIRED',
  paused: 'PAUSED',
};

/** Webhook types we act on. Everything else is recorded and ignored. */
/**
 * Whether a stored price id is one Stripe can actually charge.
 *
 * Older seeds wrote a plausible-looking `price_dev_…` placeholder. It satisfies
 * a plain "is one set?" check and then fails at Stripe with "No such price", so
 * both the checkout and the price-sync script ask here instead — one rule, so
 * the two cannot drift apart.
 */
export function isUsableStripePriceId(priceId: string | null | undefined): priceId is string {
  return typeof priceId === 'string' && priceId.length > 0 && !priceId.startsWith('price_dev_');
}

export const HANDLED_STRIPE_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'invoice.paid',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'charge.refunded',
] as const;

export class StripeAdapter {
  readonly provider = 'STRIPE' as const;
  private readonly client: Stripe;
  private readonly webhookSecret: string;

  constructor(config: StripeConfig) {
    if (!config.secretKey) {
      throw new AppError(ErrorCode.PROVIDER_ERROR, 'STRIPE_SECRET_KEY is not configured');
    }
    this.client = new Stripe(config.secretKey, {
      apiVersion: config.apiVersion ?? ('2025-09-30.clover' as Stripe.LatestApiVersion),
      appInfo: { name: 'STORM TIPS', version: '1.0.0' },
      maxNetworkRetries: 2,
      timeout: 15_000,
    });
    this.webhookSecret = config.webhookSecret;
  }

  get raw(): Stripe {
    return this.client;
  }

  /**
   * Creates a Checkout Session for a subscription.
   * `client_reference_id` and metadata carry our user id so the webhook can
   * attribute the subscription without trusting any client-supplied value.
   */
  async createCheckoutSession(params: CheckoutParams): Promise<CheckoutSession> {
    const session = await this.client.checkout.sessions.create(
      {
        mode: 'subscription',
        line_items: [{ price: params.providerPriceId, quantity: params.quantity ?? 1 }],
        client_reference_id: params.userId,
        customer_email: params.userEmail,
        success_url: `${params.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: params.cancelUrl,
        allow_promotion_codes: !params.couponCode,
        discounts: params.couponCode ? [{ promotion_code: params.couponCode }] : undefined,
        locale: (params.locale as Stripe.Checkout.SessionCreateParams.Locale) ?? 'auto',
        subscription_data: {
          trial_period_days:
            params.trialDays && params.trialDays > 0 ? params.trialDays : undefined,
          metadata: { userId: params.userId, planSlug: params.planSlug, ...params.metadata },
        },
        metadata: { userId: params.userId, planSlug: params.planSlug, ...params.metadata },
      },
      { idempotencyKey: `checkout:${params.userId}:${params.providerPriceId}:${Date.now()}` },
    );

    if (!session.url) {
      throw new AppError(ErrorCode.PROVIDER_ERROR, 'Stripe did not return a checkout URL');
    }
    return {
      id: session.id,
      url: session.url,
      provider: 'STRIPE',
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
    };
  }

  /** Self-service billing portal so users can update cards and cancel. */
  async createBillingPortalSession(customerId: string, returnUrl: string): Promise<string> {
    const session = await this.client.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return session.url;
  }

  async cancelSubscription(
    providerSubscriptionId: string,
    immediate = false,
  ): Promise<NormalizedSubscription> {
    const subscription = immediate
      ? await this.client.subscriptions.cancel(providerSubscriptionId)
      : await this.client.subscriptions.update(providerSubscriptionId, {
          cancel_at_period_end: true,
        });
    return this.toSubscription(subscription);
  }

  async fetchSubscription(providerSubscriptionId: string): Promise<NormalizedSubscription> {
    const subscription = await this.client.subscriptions.retrieve(providerSubscriptionId);
    return this.toSubscription(subscription);
  }

  /**
   * Verifies the `stripe-signature` header against the raw request body.
   * The body MUST be the untouched bytes — never a re-serialised object.
   */
  constructEvent(rawBody: Buffer | string, signature: string): Stripe.Event {
    if (!this.webhookSecret) {
      throw new AppError(ErrorCode.PROVIDER_ERROR, 'STRIPE_WEBHOOK_SECRET is not configured');
    }
    try {
      return this.client.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch (error) {
      throw new AppError(
        ErrorCode.WEBHOOK_SIGNATURE_INVALID,
        'Stripe webhook signature verification failed',
        { cause: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  /** Maps a verified Stripe event onto our normalised envelope. */
  async normalizeEvent(event: Stripe.Event): Promise<NormalizedWebhookEvent> {
    const envelope: NormalizedWebhookEvent = {
      provider: 'STRIPE',
      eventId: event.id,
      type: event.type,
      subscription: null,
      payment: null,
      raw: event,
    };

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (typeof session.subscription === 'string') {
          envelope.subscription = await this.fetchSubscription(session.subscription);
          envelope.subscription.userRef =
            session.client_reference_id ??
            session.metadata?.userId ??
            envelope.subscription.userRef;
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed': {
        envelope.subscription = this.toSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      case 'invoice.paid':
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed': {
        envelope.payment = this.toPayment(event.data.object as Stripe.Invoice, event.type);
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        envelope.payment = {
          provider: 'STRIPE',
          providerPaymentId: charge.id,
          providerSubscriptionId: null,
          providerStatus: 'refunded',
          status: charge.amount_refunded >= charge.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          amountCents: charge.amount,
          currency: charge.currency.toUpperCase(),
          description: charge.description ?? null,
          paidAt: new Date(charge.created * 1000),
          userRef: charge.metadata?.userId ?? null,
          raw: charge,
        };
        break;
      }
      default:
        break;
    }

    return envelope;
  }

  toSubscription(subscription: Stripe.Subscription): NormalizedSubscription {
    const item = subscription.items.data[0];
    const price = item?.price;
    const periodStart = item?.current_period_start ?? null;
    const periodEnd = item?.current_period_end ?? null;

    return {
      provider: 'STRIPE',
      providerSubscriptionId: subscription.id,
      providerCustomerId:
        typeof subscription.customer === 'string'
          ? subscription.customer
          : (subscription.customer?.id ?? null),
      providerStatus: subscription.status,
      status: STATUS_MAP[subscription.status] ?? 'INCOMPLETE',
      providerProductId: price?.id ?? null,
      startedAt: new Date(subscription.start_date * 1000),
      currentPeriodStart: periodStart ? new Date(periodStart * 1000) : null,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      gracePeriodEndsAt: null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      endedAt: subscription.ended_at ? new Date(subscription.ended_at * 1000) : null,
      priceCents: price?.unit_amount ?? null,
      currency: price?.currency?.toUpperCase() ?? subscription.currency?.toUpperCase() ?? null,
      userRef: subscription.metadata?.userId ?? null,
      raw: subscription,
    };
  }

  private toPayment(invoice: Stripe.Invoice, eventType: string): NormalizedPayment {
    const failed = eventType === 'invoice.payment_failed';
    const subscriptionId =
      (invoice as unknown as { subscription?: string | { id: string } }).subscription ?? null;

    return {
      provider: 'STRIPE',
      providerPaymentId: invoice.id ?? `invoice_${invoice.number ?? Date.now()}`,
      providerSubscriptionId:
        typeof subscriptionId === 'string' ? subscriptionId : (subscriptionId?.id ?? null),
      providerStatus: invoice.status ?? 'unknown',
      status: failed ? 'FAILED' : 'SUCCEEDED',
      amountCents: invoice.amount_paid || invoice.amount_due,
      currency: invoice.currency.toUpperCase(),
      description: invoice.description ?? `Invoice ${invoice.number ?? ''}`.trim(),
      paidAt: invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000)
        : null,
      userRef: invoice.metadata?.userId ?? null,
      raw: invoice,
    };
  }
}
