import { describe, expect, it, vi } from 'vitest';
import {
  ExpoPushTransport,
  PushService,
  channelForType,
  renderTemplate,
  PREFERENCE_FOR_TYPE,
  type PushTarget,
} from '../src/index.js';

const target = (token: string, locale = 'de'): PushTarget => ({
  token,
  provider: 'EXPO',
  platform: 'IOS',
  locale,
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('templates', () => {
  it('renders German copy by default', () => {
    const rendered = renderTemplate('NEW_VIP_TIP', 'de', {
      league: 'Bundesliga',
      match: 'Elversberg – Bayern',
      tipId: 'tip-1',
    });
    expect(rendered.title).toBe('Neue VIP-Analyse');
    expect(rendered.body).toContain('Elversberg – Bayern');
    expect(rendered.deepLink).toBe('profittips://vip/tip-1');
  });

  it('renders English copy', () => {
    expect(renderTemplate('NEW_VIP_TIP', 'en', {}).title).toBe('New VIP analysis');
  });

  it('falls back to German for an unknown locale', () => {
    expect(renderTemplate('NEW_COMBO', 'fr', {}).title).toBe('Neue Combo verfügbar');
  });

  it('leaves unknown placeholders intact rather than printing undefined', () => {
    expect(renderTemplate('NEW_TIP', 'de', {}).body).toContain('{league}');
  });

  it('never promises guaranteed profit', () => {
    for (const locale of ['de', 'en']) {
      for (const type of Object.keys(PREFERENCE_FOR_TYPE)) {
        const rendered = renderTemplate(type as never, locale, {});
        expect(`${rendered.title} ${rendered.body}`.toLowerCase()).not.toMatch(
          /garant|guarantee|sicher(er)? gewinn|risk-?free/,
        );
      }
    }
  });

  it('routes each type to an Android channel', () => {
    expect(channelForType('TIP_RESULT')).toBe('results');
    expect(channelForType('KICKOFF_REMINDER')).toBe('reminders');
    expect(channelForType('PROMOTION')).toBe('promotions');
    expect(channelForType('NEW_VIP_TIP')).toBe('tips');
  });
});

describe('ExpoPushTransport', () => {
  it('chunks requests at 100 messages', async () => {
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body)) as unknown[];
      return jsonResponse({ data: payload.map((_, index) => ({ status: 'ok', id: `r${index}` })) });
    });
    const transport = new ExpoPushTransport({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const targets = Array.from({ length: 250 }, (_, index) => target(`ExponentPushToken[${index}]`));

    const result = await transport.send(targets, { title: 't', body: 'b' });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)).length).toBe(100);
    expect(JSON.parse(String(fetchImpl.mock.calls[2]?.[1]?.body)).length).toBe(50);
    expect(result.sent).toBe(250);
    expect(result.failed).toBe(0);
  });

  it('flags DeviceNotRegistered tokens for deletion', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        data: [
          { status: 'ok', id: 'r1' },
          { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } },
        ],
      }),
    );
    const transport = new ExpoPushTransport({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = await transport.send([target('a'), target('b')], { title: 't', body: 'b' });

    expect(result.sent).toBe(1);
    expect(result.deliveries[1]?.unregistered).toBe(true);
  });

  it('marks every token in a chunk as failed when Expo returns an error status', async () => {
    const fetchImpl = vi.fn(async () => new Response('rate limited', { status: 429 }));
    const transport = new ExpoPushTransport({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = await transport.send([target('a')], { title: 't', body: 'b' });
    expect(result.failed).toBe(1);
    expect(result.deliveries[0]?.error).toContain('429');
  });

  it('survives a network failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    const transport = new ExpoPushTransport({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = await transport.send([target('a')], { title: 't', body: 'b' });
    expect(result.failed).toBe(1);
    expect(result.deliveries[0]?.error).toBe('ECONNRESET');
  });

  it('resolves receipts and reports dead tokens', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        data: {
          r1: { status: 'ok' },
          r2: { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
        },
      }),
    );
    const transport = new ExpoPushTransport({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const receipts = await transport.checkReceipts(['r1', 'r2']);
    expect(receipts).toHaveLength(2);
    expect(receipts[1]?.unregistered).toBe(true);
  });
});

describe('PushService', () => {
  it('groups targets by locale and sends localised copy', async () => {
    const bodies: string[] = [];
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body)) as { title: string }[];
      bodies.push(payload[0]!.title);
      return jsonResponse({ data: payload.map(() => ({ status: 'ok', id: 'r' })) });
    });
    const service = new PushService({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await service.sendTemplated(
      [target('a', 'de'), target('b', 'en'), target('c', 'de')],
      'NEW_COMBO',
      { count: 3, odds: '4.59', comboId: 'c1' },
    );

    expect(result.sent).toBe(3);
    expect(bodies.sort()).toEqual(['Neue Combo verfügbar', 'New combo available']);
  });

  it('reports targets with no registered transport instead of dropping them', async () => {
    const service = new PushService({ transports: [] });
    const result = await service.send([target('a')], { title: 't', body: 'b' });
    expect(result.failed).toBe(1);
    expect(result.deliveries[0]?.error).toContain('No transport');
  });

  it('reports a clear error when FCM is not configured', async () => {
    const service = new PushService({});
    const result = await service.send(
      [{ token: 'x', provider: 'FCM', platform: 'ANDROID' }],
      { title: 't', body: 'b' },
    );
    expect(result.failed).toBe(1);
    expect(result.deliveries[0]?.error).toContain('FCM is not configured');
  });

  it('reports a clear error when APNs is not configured', async () => {
    const service = new PushService({});
    const result = await service.send(
      [{ token: 'x', provider: 'APNS', platform: 'IOS' }],
      { title: 't', body: 'b' },
    );
    expect(result.deliveries[0]?.error).toContain('APNs is not configured');
  });
});
