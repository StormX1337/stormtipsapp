import type { DevicePlatform, NotificationType, PushProvider } from '@storm-tips/types';

export interface PushTarget {
  token: string;
  provider: PushProvider;
  platform: DevicePlatform;
  locale?: string | null;
}

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  imageUrl?: string | null;
  deepLink?: string | null;
  /** iOS badge count. */
  badge?: number | null;
  sound?: 'default' | null;
  /** Android notification channel. */
  channelId?: string;
  /** Collapses earlier notifications with the same key. */
  collapseKey?: string;
  priority?: 'default' | 'normal' | 'high';
  ttlSeconds?: number;
}

export interface PushDelivery {
  token: string;
  ok: boolean;
  /** Provider-side receipt/message id, used to poll for delivery errors. */
  receiptId?: string | null;
  error?: string;
  /** True when the token is dead and must be deactivated. */
  unregistered?: boolean;
}

export interface PushResult {
  sent: number;
  failed: number;
  deliveries: PushDelivery[];
}

export interface PushTransport {
  readonly provider: PushProvider;
  readonly configured: boolean;
  send(targets: PushTarget[], message: PushMessage): Promise<PushResult>;
  /** Optional second phase: resolve receipts to find tokens that must be dropped. */
  checkReceipts?(receiptIds: string[]): Promise<PushDelivery[]>;
}

export interface NotificationTemplateInput {
  type: NotificationType;
  locale: string;
  values: Record<string, string | number>;
}
