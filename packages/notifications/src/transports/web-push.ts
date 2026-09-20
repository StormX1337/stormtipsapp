import webpush from 'web-push';
import type { PushDelivery, PushMessage, PushResult, PushTarget, PushTransport } from '../types.js';
import { summarise } from './expo.js';

export interface WebPushTransportOptions {
  publicKey?: string | null;
  privateKey?: string | null;
  /** mailto: or https: URL identifying the sender, required by the VAPID spec. */
  subject?: string | null;
}

/**
 * The browser's own push subscription, as stored in a `PushSubscription`.
 *
 * A web push "token" is not a string the browser hands out; it is this object.
 * It is stored JSON-encoded in the same `token` column as the mobile ones, so
 * the fan-out does not need to know the difference.
 */
interface WebSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

function parseSubscription(token: string): WebSubscription | null {
  try {
    const parsed = JSON.parse(token) as WebSubscription;
    if (!parsed.endpoint || !parsed.keys?.p256dh || !parsed.keys?.auth) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Web Push (VAPID) transport for browsers.
 *
 * The payload is encrypted to the subscription's own keys before it leaves this
 * process, so the push service that relays it — Google's, Mozilla's, Apple's —
 * cannot read the tip inside.
 *
 * A 404 or 410 from the endpoint is the browser saying the subscription is
 * gone: the user cleared site data, revoked permission, or the browser rotated
 * it. That is the one case where the stored token must be deleted, and it maps
 * onto the same `unregistered` flag the mobile transports use.
 */
export class WebPushTransport implements PushTransport {
  readonly provider = 'WEB_PUSH' as const;
  private readonly publicKey: string | null;
  private readonly privateKey: string | null;
  private readonly subject: string;

  constructor(options: WebPushTransportOptions = {}) {
    this.publicKey = options.publicKey ?? null;
    this.privateKey = options.privateKey ?? null;
    this.subject = options.subject ?? 'mailto:no-reply@stormtips.app';
  }

  get configured(): boolean {
    return Boolean(this.publicKey && this.privateKey);
  }

  async send(targets: PushTarget[], message: PushMessage): Promise<PushResult> {
    const webTargets = targets.filter((target) => target.provider === 'WEB_PUSH');
    if (webTargets.length === 0) return summarise([]);
    if (!this.configured) {
      return summarise(
        webTargets.map((target) => ({
          token: target.token,
          ok: false,
          error: 'Web push is not configured (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)',
        })),
      );
    }

    webpush.setVapidDetails(this.subject, this.publicKey!, this.privateKey!);

    const payload = JSON.stringify({
      title: message.title,
      body: message.body,
      deepLink: message.deepLink ?? null,
      imageUrl: message.imageUrl ?? null,
      data: message.data ?? {},
      // Two notifications about the same match replace each other rather than
      // stacking, which is what `collapseKey` means everywhere else here.
      tag: message.collapseKey ?? null,
    });

    const deliveries = await Promise.all(
      webTargets.map(async (target): Promise<PushDelivery> => {
        const subscription = parseSubscription(target.token);
        if (!subscription) {
          // Not a subscription at all — it can never be delivered to, so it is
          // as dead as a revoked one.
          return {
            token: target.token,
            ok: false,
            error: 'Malformed subscription',
            unregistered: true,
          };
        }
        try {
          await webpush.sendNotification(subscription, payload, {
            TTL: message.ttlSeconds ?? 3600,
            urgency: message.priority === 'high' ? 'high' : 'normal',
            ...(message.collapseKey ? { topic: collapseTopic(message.collapseKey) } : {}),
          });
          return { token: target.token, ok: true };
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          return {
            token: target.token,
            ok: false,
            error: (error as Error).message,
            unregistered: status === 404 || status === 410,
          };
        }
      }),
    );

    return summarise(deliveries);
  }
}

/**
 * The `Topic` header is base64url and at most 32 characters, which our collapse
 * keys ("tip:<cuid>") are not. Anything that does not fit is dropped rather
 * than sent malformed — collapsing is a nicety, delivery is not.
 */
function collapseTopic(collapseKey: string): string | undefined {
  const topic = Buffer.from(collapseKey).toString('base64url');
  return topic.length <= 32 ? topic : undefined;
}
