import {
  AppStoreServerAPIClient,
  Environment,
  SignedDataVerifier,
  type JWSTransactionDecodedPayload,
  type JWSRenewalInfoDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from '@apple/app-store-server-library';
import { AppError, ErrorCode, type SubscriptionStatus } from '@storm-tips/types';
import type { NormalizedSubscription, NormalizedWebhookEvent } from '../types.js';

export interface AppleConfig {
  bundleId: string;
  issuerId: string;
  keyId: string;
  /** Contents of the AuthKey_XXXXXXXX.p8 downloaded from App Store Connect. */
  privateKey: string;
  environment: 'Sandbox' | 'Production';
  /** Apple root certificates (DER). Required for full JWS chain verification. */
  rootCertificates?: Buffer[];
  appAppleId?: number;
}

/**
 * Apple App Store adapter.
 *
 * Two entry points:
 *  • `verifyTransaction` — called when the app reports a purchase. The signed
 *    JWS is verified against Apple's root certificate chain, then the
 *    authoritative subscription state is fetched from the App Store Server API.
 *  • `handleNotification` — App Store Server Notifications V2 (`signedPayload`).
 *
 * `originalTransactionId` is the stable subscription identity across renewals,
 * so it is what we persist as `providerSubscriptionId`.
 */
export class AppleAdapter {
  readonly provider = 'APPLE' as const;
  private readonly config: AppleConfig;
  private client: AppStoreServerAPIClient | null = null;
  private verifier: SignedDataVerifier | null = null;

  constructor(config: AppleConfig) {
    this.config = config;
  }

  private get environment(): Environment {
    return this.config.environment === 'Production' ? Environment.PRODUCTION : Environment.SANDBOX;
  }

  private requireConfigured(): void {
    const missing = (['bundleId', 'issuerId', 'keyId', 'privateKey'] as const).filter(
      (key) => !this.config[key],
    );
    if (missing.length > 0) {
      throw new AppError(
        ErrorCode.PROVIDER_ERROR,
        `Apple in-app purchases are not configured (missing: ${missing.join(', ')}). ` +
          'Set APPLE_ISSUER_ID, APPLE_KEY_ID and APPLE_PRIVATE_KEY — see docs/payments.md.',
      );
    }
  }

  private getClient(): AppStoreServerAPIClient {
    this.requireConfigured();
    this.client ??= new AppStoreServerAPIClient(
      this.config.privateKey,
      this.config.keyId,
      this.config.issuerId,
      this.config.bundleId,
      this.environment,
    );
    return this.client;
  }

  private getVerifier(): SignedDataVerifier {
    this.requireConfigured();
    const roots = this.config.rootCertificates ?? [];
    if (roots.length === 0) {
      throw new AppError(
        ErrorCode.PROVIDER_ERROR,
        'Apple root certificates are not loaded. Download the Apple Root CA - G3 certificate ' +
          'and point APPLE_ROOT_CERTS_DIR at it — see docs/payments.md.',
      );
    }
    this.verifier ??= new SignedDataVerifier(
      roots,
      true,
      this.environment,
      this.config.bundleId,
      this.config.appAppleId,
    );
    return this.verifier;
  }

  /**
   * Verifies a StoreKit 2 signed transaction and returns the authoritative
   * subscription state from Apple — never the client's claim.
   */
  async verifyTransaction(signedTransaction: string): Promise<NormalizedSubscription> {
    const decoded = await this.getVerifier().verifyAndDecodeTransaction(signedTransaction);
    if (!decoded.originalTransactionId) {
      throw new AppError(ErrorCode.PROVIDER_ERROR, 'Apple transaction is missing an original id');
    }

    // Authoritative state: ask Apple directly rather than trusting the JWS alone.
    const statuses = await this.getClient().getAllSubscriptionStatuses(
      decoded.originalTransactionId,
    );

    let renewalInfo: JWSRenewalInfoDecodedPayload | null = null;
    let latestTransaction: JWSTransactionDecodedPayload = decoded;
    let statusCode: number | undefined;

    for (const group of statuses.data ?? []) {
      for (const item of group.lastTransactions ?? []) {
        if (item.originalTransactionId !== decoded.originalTransactionId) continue;
        statusCode = item.status;
        if (item.signedTransactionInfo) {
          latestTransaction = await this.getVerifier().verifyAndDecodeTransaction(
            item.signedTransactionInfo,
          );
        }
        if (item.signedRenewalInfo) {
          renewalInfo = await this.getVerifier().verifyAndDecodeRenewalInfo(item.signedRenewalInfo);
        }
      }
    }

    return this.toSubscription(latestTransaction, renewalInfo, statusCode);
  }

  /** Verifies and decodes an App Store Server Notification V2 payload. */
  async handleNotification(signedPayload: string): Promise<NormalizedWebhookEvent> {
    let decoded: ResponseBodyV2DecodedPayload;
    try {
      decoded = await this.getVerifier().verifyAndDecodeNotification(signedPayload);
    } catch (error) {
      throw new AppError(
        ErrorCode.WEBHOOK_SIGNATURE_INVALID,
        'Apple notification signature verification failed',
        { cause: error instanceof Error ? error.message : String(error) },
      );
    }

    const envelope: NormalizedWebhookEvent = {
      provider: 'APPLE',
      eventId: decoded.notificationUUID ?? `apple:${Date.now()}`,
      type: `${decoded.notificationType}${decoded.subtype ? `.${decoded.subtype}` : ''}`,
      subscription: null,
      payment: null,
      raw: decoded,
    };

    const signedTransaction = decoded.data?.signedTransactionInfo;
    if (signedTransaction) {
      const transaction = await this.getVerifier().verifyAndDecodeTransaction(signedTransaction);
      const renewal = decoded.data?.signedRenewalInfo
        ? await this.getVerifier().verifyAndDecodeRenewalInfo(decoded.data.signedRenewalInfo)
        : null;
      envelope.subscription = this.toSubscription(transaction, renewal, decoded.data?.status);
      envelope.subscription.providerStatus = envelope.type;
    }

    return envelope;
  }

  /**
   * Maps Apple's transaction + renewal info onto our subscription shape.
   *
   * `status` is the App Store subscription status code:
   * 1 active · 2 expired · 3 billing retry · 4 billing grace period · 5 revoked.
   */
  toSubscription(
    transaction: JWSTransactionDecodedPayload,
    renewal: JWSRenewalInfoDecodedPayload | null,
    statusCode?: number,
  ): NormalizedSubscription {
    const expiresAt = transaction.expiresDate ? new Date(transaction.expiresDate) : null;
    const purchaseDate = transaction.purchaseDate ? new Date(transaction.purchaseDate) : new Date();
    const gracePeriodEnd = renewal?.gracePeriodExpiresDate
      ? new Date(renewal.gracePeriodExpiresDate)
      : null;
    const autoRenew = renewal?.autoRenewStatus === 1;

    let status: SubscriptionStatus;
    switch (statusCode) {
      case 1:
        status = transaction.offerType === 1 ? 'TRIALING' : 'ACTIVE';
        break;
      case 2:
        status = 'EXPIRED';
        break;
      case 3:
        status = 'PAST_DUE';
        break;
      case 4:
        status = 'GRACE_PERIOD';
        break;
      case 5:
        status = 'CANCELED';
        break;
      default:
        status = expiresAt && expiresAt.getTime() > Date.now() ? 'ACTIVE' : 'EXPIRED';
    }
    if (status === 'ACTIVE' && !autoRenew && renewal) status = 'CANCELED';

    return {
      provider: 'APPLE',
      providerSubscriptionId: transaction.originalTransactionId ?? transaction.transactionId ?? '',
      providerCustomerId: transaction.appAccountToken ?? null,
      providerStatus: statusCode !== undefined ? `status:${statusCode}` : 'unknown',
      status,
      providerProductId: transaction.productId ?? null,
      startedAt: transaction.originalPurchaseDate
        ? new Date(transaction.originalPurchaseDate)
        : purchaseDate,
      currentPeriodStart: purchaseDate,
      currentPeriodEnd: expiresAt,
      trialEndsAt: transaction.offerType === 1 ? expiresAt : null,
      gracePeriodEndsAt: gracePeriodEnd,
      cancelAtPeriodEnd: renewal ? !autoRenew : false,
      canceledAt: renewal && !autoRenew ? new Date() : null,
      endedAt: transaction.revocationDate ? new Date(transaction.revocationDate) : null,
      priceCents: typeof transaction.price === 'number' ? Math.round(transaction.price / 10) : null,
      currency: transaction.currency ?? null,
      /** The app sets `appAccountToken` to our user id at purchase time. */
      userRef: transaction.appAccountToken ?? null,
      raw: { transaction, renewal },
    };
  }
}

/** Notification types that must update entitlements. */
export const APPLE_ENTITLEMENT_EVENTS = [
  'SUBSCRIBED',
  'DID_RENEW',
  'DID_CHANGE_RENEWAL_STATUS',
  'DID_CHANGE_RENEWAL_PREF',
  'EXPIRED',
  'GRACE_PERIOD_EXPIRED',
  'DID_FAIL_TO_RENEW',
  'REFUND',
  'REVOKE',
  'OFFER_REDEEMED',
] as const;
