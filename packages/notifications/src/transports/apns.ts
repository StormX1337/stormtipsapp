import http2 from 'node:http2';
import { SignJWT, importPKCS8 } from 'jose';
import type { PushDelivery, PushMessage, PushResult, PushTarget, PushTransport } from '../types.js';
import { summarise } from './expo.js';

export interface ApnsTransportOptions {
  keyId?: string | null;
  teamId?: string | null;
  /** Contents of the AuthKey_XXXXXXXX.p8 downloaded from the Apple developer portal. */
  privateKey?: string | null;
  bundleId?: string | null;
  production?: boolean;
}

const PRODUCTION_HOST = 'https://api.push.apple.com';
const SANDBOX_HOST = 'https://api.sandbox.push.apple.com';
/** Apple caches provider tokens; they must be refreshed between 20 and 60 minutes. */
const TOKEN_TTL_MS = 45 * 60 * 1000;

/**
 * APNs transport using token-based authentication over HTTP/2.
 *
 * Used by bare iOS builds that talk to APNs directly instead of going through
 * the Expo push service. One HTTP/2 session is reused for a whole batch, which
 * is what Apple asks providers to do.
 */
export class ApnsPushTransport implements PushTransport {
  readonly provider = 'APNS' as const;
  private readonly options: ApnsTransportOptions;
  private cachedToken: { value: string; issuedAt: number } | null = null;

  constructor(options: ApnsTransportOptions = {}) {
    this.options = options;
  }

  get configured(): boolean {
    return Boolean(
      this.options.keyId && this.options.teamId && this.options.privateKey && this.options.bundleId,
    );
  }

  private get host(): string {
    return this.options.production ? PRODUCTION_HOST : SANDBOX_HOST;
  }

  /** ES256 provider token, cached for 45 minutes per Apple's guidance. */
  private async providerToken(): Promise<string> {
    if (this.cachedToken && Date.now() - this.cachedToken.issuedAt < TOKEN_TTL_MS) {
      return this.cachedToken.value;
    }
    const key = await importPKCS8(this.options.privateKey as string, 'ES256');
    const value = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: this.options.keyId as string })
      .setIssuer(this.options.teamId as string)
      .setIssuedAt()
      .sign(key);
    this.cachedToken = { value, issuedAt: Date.now() };
    return value;
  }

  async send(targets: PushTarget[], message: PushMessage): Promise<PushResult> {
    const apnsTargets = targets.filter((target) => target.provider === 'APNS');
    if (apnsTargets.length === 0) return summarise([]);
    if (!this.configured) {
      return summarise(
        apnsTargets.map((target) => ({
          token: target.token,
          ok: false,
          error: 'APNs is not configured (APNS_KEY_ID / APNS_TEAM_ID / APNS_PRIVATE_KEY)',
        })),
      );
    }

    const token = await this.providerToken();
    const payload = JSON.stringify({
      aps: {
        alert: { title: message.title, body: message.body },
        sound: message.sound ?? 'default',
        badge: message.badge ?? undefined,
        'mutable-content': message.imageUrl ? 1 : undefined,
      },
      deepLink: message.deepLink ?? undefined,
      imageUrl: message.imageUrl ?? undefined,
      ...message.data,
    });

    const client = http2.connect(this.host);
    const deliveries: PushDelivery[] = [];

    try {
      await Promise.all(
        apnsTargets.map(
          (target) =>
            new Promise<void>((resolve) => {
              const request = client.request({
                ':method': 'POST',
                ':path': `/3/device/${target.token}`,
                authorization: `bearer ${token}`,
                'apns-topic': this.options.bundleId as string,
                'apns-push-type': 'alert',
                'apns-priority': message.priority === 'normal' ? '5' : '10',
                'apns-collapse-id': message.collapseKey,
                'apns-expiration': message.ttlSeconds
                  ? String(Math.floor(Date.now() / 1000) + message.ttlSeconds)
                  : '0',
                'content-type': 'application/json',
              });

              let status = 0;
              let body = '';
              request.setEncoding('utf8');
              request.on('response', (headers) => {
                status = Number(headers[':status'] ?? 0);
              });
              request.on('data', (chunk: string) => {
                body += chunk;
              });
              request.on('error', (error: Error) => {
                deliveries.push({ token: target.token, ok: false, error: error.message });
                resolve();
              });
              request.on('end', () => {
                if (status === 200) {
                  deliveries.push({ token: target.token, ok: true });
                } else {
                  const reason = safeReason(body);
                  deliveries.push({
                    token: target.token,
                    ok: false,
                    error: `APNs ${status}: ${reason}`,
                    unregistered: reason === 'BadDeviceToken' || reason === 'Unregistered',
                  });
                }
                resolve();
              });

              request.end(payload);
            }),
        ),
      );
    } finally {
      client.close();
    }

    return summarise(deliveries);
  }
}

function safeReason(body: string): string {
  try {
    return (JSON.parse(body) as { reason?: string }).reason ?? 'unknown';
  } catch {
    return body.slice(0, 120) || 'unknown';
  }
}
