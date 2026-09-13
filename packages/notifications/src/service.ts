import type { NotificationType } from '@profit-tips/types';
import { ExpoPushTransport, summarise } from './transports/expo.js';
import { FcmPushTransport } from './transports/fcm.js';
import { ApnsPushTransport } from './transports/apns.js';
import { channelForType, renderTemplate } from './templates.js';
import type { PushDelivery, PushMessage, PushResult, PushTarget, PushTransport } from './types.js';

export interface PushServiceOptions {
  expoAccessToken?: string | null;
  fcm?: { projectId?: string | null; serviceAccountJsonBase64?: string | null };
  apns?: {
    keyId?: string | null;
    teamId?: string | null;
    privateKey?: string | null;
    bundleId?: string | null;
    production?: boolean;
  };
  fetchImpl?: typeof fetch;
  /** Transports can be injected in tests. */
  transports?: PushTransport[];
}

/**
 * Fan-out façade over the individual transports.
 *
 * Each device token records which transport delivered it, so one call can
 * address Expo, FCM and APNs devices at once and still return a single result.
 */
export class PushService {
  private readonly transports: Map<string, PushTransport>;

  constructor(options: PushServiceOptions = {}) {
    const transports =
      options.transports ??
      ([
        new ExpoPushTransport({
          accessToken: options.expoAccessToken ?? null,
          fetchImpl: options.fetchImpl,
        }),
        new FcmPushTransport({
          projectId: options.fcm?.projectId ?? null,
          serviceAccountJsonBase64: options.fcm?.serviceAccountJsonBase64 ?? null,
          fetchImpl: options.fetchImpl,
        }),
        new ApnsPushTransport(options.apns ?? {}),
      ] as PushTransport[]);

    this.transports = new Map(transports.map((transport) => [transport.provider, transport]));
  }

  transportFor(provider: string): PushTransport | undefined {
    return this.transports.get(provider);
  }

  /** Sends one message to every target, routed by the target's transport. */
  async send(targets: PushTarget[], message: PushMessage): Promise<PushResult> {
    const grouped = new Map<string, PushTarget[]>();
    for (const target of targets) {
      const list = grouped.get(target.provider) ?? [];
      list.push(target);
      grouped.set(target.provider, list);
    }

    const deliveries: PushDelivery[] = [];
    for (const [provider, group] of grouped) {
      const transport = this.transports.get(provider);
      if (!transport) {
        deliveries.push(
          ...group.map((target) => ({
            token: target.token,
            ok: false,
            error: `No transport registered for ${provider}`,
          })),
        );
        continue;
      }
      const result = await transport.send(group, message);
      deliveries.push(...result.deliveries);
    }

    return summarise(deliveries);
  }

  /**
   * Renders localised copy and sends it, grouping targets by locale so each
   * device gets the message in its own language.
   */
  async sendTemplated(
    targets: PushTarget[],
    type: NotificationType,
    values: Record<string, string | number>,
    overrides: Partial<PushMessage> = {},
  ): Promise<PushResult> {
    const byLocale = new Map<string, PushTarget[]>();
    for (const target of targets) {
      const locale = (target.locale ?? 'de').split('-')[0] ?? 'de';
      const list = byLocale.get(locale) ?? [];
      list.push(target);
      byLocale.set(locale, list);
    }

    const deliveries: PushDelivery[] = [];
    for (const [locale, group] of byLocale) {
      const rendered = renderTemplate(type, locale, values);
      const result = await this.send(group, {
        title: rendered.title,
        body: rendered.body,
        deepLink: rendered.deepLink,
        channelId: channelForType(type),
        data: { type, ...values },
        priority: 'high',
        ...overrides,
      });
      deliveries.push(...result.deliveries);
    }
    return summarise(deliveries);
  }

  /** Resolves Expo receipts; returns the tokens whose receipts say to drop them. */
  async checkReceipts(provider: string, receiptIds: string[]): Promise<PushDelivery[]> {
    const transport = this.transports.get(provider);
    if (!transport?.checkReceipts) return [];
    return transport.checkReceipts(receiptIds);
  }
}
