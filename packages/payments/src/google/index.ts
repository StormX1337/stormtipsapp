import { JWT, OAuth2Client } from 'google-auth-library';
import { AppError, ErrorCode, type SubscriptionStatus } from '@storm-tips/types';
import type { NormalizedSubscription, NormalizedWebhookEvent } from '../types.js';

export interface GoogleConfig {
  packageName: string;
  /** Base64 encoded service-account JSON with the androidpublisher scope. */
  serviceAccountJsonBase64: string;
  /** Expected audience of the Pub/Sub push OIDC token. */
  pubsubAudience?: string;
  /** Service account email Google Pub/Sub signs push requests with. */
  pubsubServiceAccountEmail?: string;
}

/** Google Play `SubscriptionPurchaseV2.subscriptionState`. */
const STATE_MAP: Record<string, SubscriptionStatus> = {
  SUBSCRIPTION_STATE_UNSPECIFIED: 'INCOMPLETE',
  SUBSCRIPTION_STATE_PENDING: 'INCOMPLETE',
  SUBSCRIPTION_STATE_ACTIVE: 'ACTIVE',
  SUBSCRIPTION_STATE_PAUSED: 'PAUSED',
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD: 'GRACE_PERIOD',
  SUBSCRIPTION_STATE_ON_HOLD: 'PAST_DUE',
  SUBSCRIPTION_STATE_CANCELED: 'CANCELED',
  SUBSCRIPTION_STATE_EXPIRED: 'EXPIRED',
};

/** `SubscriptionNotification.notificationType` values. */
export const GOOGLE_NOTIFICATION_TYPES: Record<number, string> = {
  1: 'SUBSCRIPTION_RECOVERED',
  2: 'SUBSCRIPTION_RENEWED',
  3: 'SUBSCRIPTION_CANCELED',
  4: 'SUBSCRIPTION_PURCHASED',
  5: 'SUBSCRIPTION_ON_HOLD',
  6: 'SUBSCRIPTION_IN_GRACE_PERIOD',
  7: 'SUBSCRIPTION_RESTARTED',
  8: 'SUBSCRIPTION_PRICE_CHANGE_CONFIRMED',
  9: 'SUBSCRIPTION_DEFERRED',
  10: 'SUBSCRIPTION_PAUSED',
  11: 'SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED',
  12: 'SUBSCRIPTION_REVOKED',
  13: 'SUBSCRIPTION_EXPIRED',
  20: 'SUBSCRIPTION_PENDING_PURCHASE_CANCELED',
};

interface SubscriptionPurchaseV2 {
  kind?: string;
  regionCode?: string;
  startTime?: string;
  subscriptionState?: string;
  latestOrderId?: string;
  linkedPurchaseToken?: string;
  acknowledgementState?: string;
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string; externalAccountId?: string };
  testPurchase?: object;
  lineItems?: {
    productId?: string;
    expiryTime?: string;
    autoRenewingPlan?: { autoRenewEnabled?: boolean };
    offerDetails?: { basePlanId?: string; offerId?: string };
    prepaidPlan?: { allowExtendAfterTime?: string };
  }[];
  canceledStateContext?: {
    userInitiatedCancellation?: { cancelTime?: string };
    systemInitiatedCancellation?: object;
    developerInitiatedCancellation?: object;
  };
  pausedStateContext?: { autoResumeTime?: string };
}

export interface GoogleRtdnMessage {
  version?: string;
  packageName?: string;
  eventTimeMillis?: string;
  subscriptionNotification?: {
    version?: string;
    notificationType?: number;
    purchaseToken?: string;
    subscriptionId?: string;
  };
  oneTimeProductNotification?: {
    version?: string;
    notificationType?: number;
    purchaseToken?: string;
    sku?: string;
  };
  testNotification?: { version?: string };
}

const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const ANDROID_PUBLISHER_BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3';

/**
 * Google Play adapter.
 *
 * Uses `purchases.subscriptionsv2.get` (the current API; the v1
 * `purchases.subscriptions` endpoint is deprecated) and Real-Time Developer
 * Notifications delivered over Pub/Sub push. Pub/Sub push requests are
 * authenticated by verifying the OIDC bearer token Google attaches.
 */
export class GoogleAdapter {
  readonly provider = 'GOOGLE' as const;
  private readonly config: GoogleConfig;
  private jwt: JWT | null = null;
  private readonly oauthClient = new OAuth2Client();

  constructor(config: GoogleConfig) {
    this.config = config;
  }

  private getJwt(): JWT {
    if (!this.config.serviceAccountJsonBase64) {
      throw new AppError(
        ErrorCode.PROVIDER_ERROR,
        'Google Play purchases are not configured. Set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64 ' +
          '— see docs/payments.md.',
      );
    }
    if (!this.jwt) {
      let credentials: { client_email?: string; private_key?: string };
      try {
        credentials = JSON.parse(
          Buffer.from(this.config.serviceAccountJsonBase64, 'base64').toString('utf8'),
        );
      } catch {
        throw new AppError(
          ErrorCode.PROVIDER_ERROR,
          'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64 is not valid base64-encoded JSON',
        );
      }
      if (!credentials.client_email || !credentials.private_key) {
        throw new AppError(ErrorCode.PROVIDER_ERROR, 'Google service account JSON is incomplete');
      }
      this.jwt = new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: [ANDROID_PUBLISHER_SCOPE],
      });
    }
    return this.jwt;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getJwt().getAccessToken();
    const response = await fetch(`${ANDROID_PUBLISHER_BASE}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        authorization: `Bearer ${token.token}`,
        'content-type': 'application/json',
      },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new AppError(
        ErrorCode.PROVIDER_ERROR,
        `Google Play API request failed (${response.status})`,
        { body: body.slice(0, 500) },
      );
    }
    if (response.status === 204) return {} as T;
    return (await response.json()) as T;
  }

  /** Fetches the authoritative subscription state for a purchase token. */
  async verifyPurchase(
    purchaseToken: string,
    packageName?: string,
  ): Promise<NormalizedSubscription> {
    const pkg = packageName ?? this.config.packageName;
    const purchase = await this.request<SubscriptionPurchaseV2>(
      `/applications/${encodeURIComponent(pkg)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
    );
    return this.toSubscription(purchase, purchaseToken);
  }

  /** Google requires a purchase to be acknowledged within three days. */
  async acknowledge(
    purchaseToken: string,
    subscriptionId: string,
    packageName?: string,
  ): Promise<void> {
    const pkg = packageName ?? this.config.packageName;
    await this.request(
      `/applications/${encodeURIComponent(pkg)}/purchases/subscriptions/${encodeURIComponent(subscriptionId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
      { method: 'POST', body: JSON.stringify({}) },
    );
  }

  /**
   * Verifies the OIDC bearer token on a Pub/Sub push request.
   * Without this any host could POST fake renewal notifications.
   */
  async verifyPushToken(authorizationHeader: string | undefined): Promise<void> {
    if (!this.config.pubsubAudience) return; // verification disabled (e.g. local dev)
    const token = authorizationHeader?.replace(/^Bearer\s+/i, '');
    if (!token) {
      throw new AppError(ErrorCode.WEBHOOK_SIGNATURE_INVALID, 'Missing Pub/Sub OIDC token');
    }
    try {
      const ticket = await this.oauthClient.verifyIdToken({
        idToken: token,
        audience: this.config.pubsubAudience,
      });
      const payload = ticket.getPayload();
      if (
        this.config.pubsubServiceAccountEmail &&
        payload?.email !== this.config.pubsubServiceAccountEmail
      ) {
        throw new Error('unexpected service account');
      }
      if (payload?.email_verified === false) throw new Error('email not verified');
    } catch (error) {
      throw new AppError(
        ErrorCode.WEBHOOK_SIGNATURE_INVALID,
        'Pub/Sub OIDC token verification failed',
        { cause: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  /** Decodes a Pub/Sub push body into an RTDN message. */
  decodePushBody(body: { message?: { data?: string; messageId?: string } }): {
    message: GoogleRtdnMessage;
    messageId: string;
  } {
    const data = body.message?.data;
    if (!data) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Pub/Sub push body has no message data');
    }
    try {
      return {
        message: JSON.parse(Buffer.from(data, 'base64').toString('utf8')) as GoogleRtdnMessage,
        messageId: body.message?.messageId ?? `google:${Date.now()}`,
      };
    } catch {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Pub/Sub message data is not valid JSON');
    }
  }

  /** Fetches current state for the purchase referenced by an RTDN message. */
  async handleNotification(
    message: GoogleRtdnMessage,
    messageId: string,
  ): Promise<NormalizedWebhookEvent> {
    const notification = message.subscriptionNotification;
    const type = notification?.notificationType
      ? (GOOGLE_NOTIFICATION_TYPES[notification.notificationType] ??
        `UNKNOWN_${notification.notificationType}`)
      : message.testNotification
        ? 'TEST'
        : 'UNKNOWN';

    const envelope: NormalizedWebhookEvent = {
      provider: 'GOOGLE',
      eventId: messageId,
      type,
      subscription: null,
      payment: null,
      raw: message,
    };

    if (notification?.purchaseToken) {
      envelope.subscription = await this.verifyPurchase(
        notification.purchaseToken,
        message.packageName,
      );
      envelope.subscription.providerStatus = type;
    }
    return envelope;
  }

  toSubscription(purchase: SubscriptionPurchaseV2, purchaseToken: string): NormalizedSubscription {
    const lineItem = purchase.lineItems?.[0];
    const expiry = lineItem?.expiryTime ? new Date(lineItem.expiryTime) : null;
    const startTime = purchase.startTime ? new Date(purchase.startTime) : new Date();
    const state = purchase.subscriptionState ?? 'SUBSCRIPTION_STATE_UNSPECIFIED';
    const autoRenew = lineItem?.autoRenewingPlan?.autoRenewEnabled ?? false;
    const cancelTime = purchase.canceledStateContext?.userInitiatedCancellation?.cancelTime;

    return {
      provider: 'GOOGLE',
      providerSubscriptionId: purchaseToken,
      providerCustomerId: purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null,
      providerStatus: state,
      status: STATE_MAP[state] ?? 'INCOMPLETE',
      providerProductId: lineItem?.productId ?? null,
      startedAt: startTime,
      currentPeriodStart: startTime,
      currentPeriodEnd: expiry,
      trialEndsAt: lineItem?.offerDetails?.offerId ? expiry : null,
      gracePeriodEndsAt: state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' ? expiry : null,
      cancelAtPeriodEnd: !autoRenew,
      canceledAt: cancelTime ? new Date(cancelTime) : null,
      endedAt: state === 'SUBSCRIPTION_STATE_EXPIRED' ? expiry : null,
      priceCents: null,
      currency: null,
      userRef:
        purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId ??
        purchase.externalAccountIdentifiers?.externalAccountId ??
        null,
      raw: purchase,
    };
  }
}
