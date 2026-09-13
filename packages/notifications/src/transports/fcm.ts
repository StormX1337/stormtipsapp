import { JWT } from 'google-auth-library';
import type { PushDelivery, PushMessage, PushResult, PushTarget, PushTransport } from '../types.js';
import { summarise } from './expo.js';

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

export interface FcmTransportOptions {
  projectId?: string | null;
  serviceAccountJsonBase64?: string | null;
  fetchImpl?: typeof fetch;
}

/**
 * Firebase Cloud Messaging HTTP v1 transport, used by bare/production Android
 * builds that do not go through the Expo push service.
 *
 * FCM v1 sends one message per request, so delivery is parallelised in small
 * batches rather than chunked like Expo.
 */
export class FcmPushTransport implements PushTransport {
  readonly provider = 'FCM' as const;
  private readonly projectId: string | null;
  private readonly credentialsBase64: string | null;
  private readonly fetchImpl: typeof fetch;
  private jwt: JWT | null = null;

  constructor(options: FcmTransportOptions = {}) {
    this.projectId = options.projectId ?? null;
    this.credentialsBase64 = options.serviceAccountJsonBase64 ?? null;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  get configured(): boolean {
    return Boolean(this.projectId && this.credentialsBase64);
  }

  private getJwt(): JWT {
    if (!this.credentialsBase64) throw new Error('FCM service account is not configured');
    if (!this.jwt) {
      const credentials = JSON.parse(
        Buffer.from(this.credentialsBase64, 'base64').toString('utf8'),
      ) as { client_email: string; private_key: string };
      this.jwt = new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: [FCM_SCOPE],
      });
    }
    return this.jwt;
  }

  async send(targets: PushTarget[], message: PushMessage): Promise<PushResult> {
    const fcmTargets = targets.filter((target) => target.provider === 'FCM');
    if (fcmTargets.length === 0) return summarise([]);
    if (!this.configured) {
      return summarise(
        fcmTargets.map((target) => ({
          token: target.token,
          ok: false,
          error: 'FCM is not configured (FCM_PROJECT_ID / FCM_SERVICE_ACCOUNT_JSON_BASE64)',
        })),
      );
    }

    const accessToken = await this.getJwt().getAccessToken();
    const url = `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`;
    const deliveries: PushDelivery[] = [];

    const batchSize = 20;
    for (let index = 0; index < fcmTargets.length; index += batchSize) {
      const batch = fcmTargets.slice(index, index + batchSize);
      const results = await Promise.all(
        batch.map(async (target): Promise<PushDelivery> => {
          try {
            const response = await this.fetchImpl(url, {
              method: 'POST',
              headers: {
                authorization: `Bearer ${accessToken.token}`,
                'content-type': 'application/json',
              },
              body: JSON.stringify({
                message: {
                  token: target.token,
                  notification: {
                    title: message.title,
                    body: message.body,
                    image: message.imageUrl ?? undefined,
                  },
                  data: Object.fromEntries(
                    Object.entries({
                      ...message.data,
                      deepLink: message.deepLink ?? '',
                    }).map(([key, value]) => [key, String(value)]),
                  ),
                  android: {
                    priority: message.priority === 'high' ? 'HIGH' : 'NORMAL',
                    collapse_key: message.collapseKey,
                    ttl: message.ttlSeconds ? `${message.ttlSeconds}s` : undefined,
                    notification: { channel_id: message.channelId ?? 'tips' },
                  },
                  apns: {
                    payload: {
                      aps: { badge: message.badge ?? undefined, sound: message.sound ?? 'default' },
                    },
                  },
                },
              }),
            });

            if (response.ok) {
              const body = (await response.json()) as { name?: string };
              return { token: target.token, ok: true, receiptId: body.name ?? null };
            }
            const text = await response.text().catch(() => '');
            return {
              token: target.token,
              ok: false,
              error: `FCM ${response.status}: ${text.slice(0, 200)}`,
              unregistered: response.status === 404 || text.includes('UNREGISTERED'),
            };
          } catch (error) {
            return {
              token: target.token,
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }),
      );
      deliveries.push(...results);
    }

    return summarise(deliveries);
  }
}
