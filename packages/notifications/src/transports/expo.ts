import type { PushDelivery, PushMessage, PushResult, PushTarget, PushTransport } from '../types.js';

const EXPO_SEND_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
/** Expo hard limit: at most 100 messages per request. */
const CHUNK_SIZE = 100;

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoReceipt {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

export interface ExpoTransportOptions {
  accessToken?: string | null;
  fetchImpl?: typeof fetch;
}

/**
 * Expo push transport.
 *
 * Two phases, exactly as Expo's documentation requires:
 *  1. POST up to 100 messages and collect tickets.
 *  2. Later, poll `getReceipts` with the ticket ids — a `DeviceNotRegistered`
 *     receipt is the only reliable signal that a token must be deleted.
 */
export class ExpoPushTransport implements PushTransport {
  readonly provider = 'EXPO' as const;
  private readonly accessToken: string | null;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ExpoTransportOptions = {}) {
    this.accessToken = options.accessToken ?? null;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  /** Expo works without an access token; one only raises the rate limit. */
  get configured(): boolean {
    return true;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json',
      'accept-encoding': 'gzip, deflate',
    };
    if (this.accessToken) headers.authorization = `Bearer ${this.accessToken}`;
    return headers;
  }

  async send(targets: PushTarget[], message: PushMessage): Promise<PushResult> {
    const expoTargets = targets.filter((target) => target.provider === 'EXPO');
    const deliveries: PushDelivery[] = [];

    for (let index = 0; index < expoTargets.length; index += CHUNK_SIZE) {
      const chunk = expoTargets.slice(index, index + CHUNK_SIZE);
      const payload = chunk.map((target) => ({
        to: target.token,
        title: message.title,
        body: message.body,
        data: { ...message.data, deepLink: message.deepLink ?? undefined },
        sound: message.sound === null ? undefined : 'default',
        badge: message.badge ?? undefined,
        channelId: message.channelId,
        priority: message.priority ?? 'high',
        ttl: message.ttlSeconds,
        collapseId: message.collapseKey,
        richContent: message.imageUrl ? { image: message.imageUrl } : undefined,
      }));

      try {
        const response = await this.fetchImpl(EXPO_SEND_URL, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const text = await response.text().catch(() => '');
          for (const target of chunk) {
            deliveries.push({
              token: target.token,
              ok: false,
              error: `Expo responded ${response.status}: ${text.slice(0, 200)}`,
            });
          }
          continue;
        }
        const body = (await response.json()) as { data?: ExpoTicket[] };
        const tickets = body.data ?? [];
        chunk.forEach((target, position) => {
          const ticket = tickets[position];
          if (ticket?.status === 'ok') {
            deliveries.push({ token: target.token, ok: true, receiptId: ticket.id ?? null });
          } else {
            deliveries.push({
              token: target.token,
              ok: false,
              error: ticket?.message ?? 'unknown Expo error',
              unregistered: ticket?.details?.error === 'DeviceNotRegistered',
            });
          }
        });
      } catch (error) {
        for (const target of chunk) {
          deliveries.push({
            token: target.token,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return summarise(deliveries);
  }

  async checkReceipts(receiptIds: string[]): Promise<PushDelivery[]> {
    const deliveries: PushDelivery[] = [];
    for (let index = 0; index < receiptIds.length; index += 300) {
      const chunk = receiptIds.slice(index, index + 300);
      try {
        const response = await this.fetchImpl(EXPO_RECEIPTS_URL, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({ ids: chunk }),
        });
        if (!response.ok) continue;
        const body = (await response.json()) as { data?: Record<string, ExpoReceipt> };
        for (const [receiptId, receipt] of Object.entries(body.data ?? {})) {
          deliveries.push({
            token: receiptId,
            receiptId,
            ok: receipt.status === 'ok',
            error: receipt.message,
            unregistered: receipt.details?.error === 'DeviceNotRegistered',
          });
        }
      } catch {
        // Receipts are advisory; a failed poll is retried by the next job run.
      }
    }
    return deliveries;
  }
}

export function summarise(deliveries: PushDelivery[]): PushResult {
  return {
    sent: deliveries.filter((delivery) => delivery.ok).length,
    failed: deliveries.filter((delivery) => !delivery.ok).length,
    deliveries,
  };
}
