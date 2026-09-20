import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendNotification = vi.fn();
const setVapidDetails = vi.fn();

vi.mock('web-push', () => ({
  default: {
    sendNotification: (...args: unknown[]) => sendNotification(...args),
    setVapidDetails: (...args: unknown[]) => setVapidDetails(...args),
  },
}));

const { WebPushTransport } = await import('../src/transports/web-push.js');

const SUBSCRIPTION = JSON.stringify({
  endpoint: 'https://push.example.test/abc',
  keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
});

function target(token = SUBSCRIPTION) {
  return { token, provider: 'WEB_PUSH' as const, platform: 'WEB' as const };
}

const MESSAGE = { title: 'New analysis', body: 'Milan – Juventus' };

describe('WebPushTransport', () => {
  beforeEach(() => {
    sendNotification.mockReset();
    setVapidDetails.mockReset();
  });

  it('refuses to send without a VAPID pair, instead of failing silently', async () => {
    const transport = new WebPushTransport();
    const result = await transport.send([target()], MESSAGE);
    expect(result.sent).toBe(0);
    expect(result.deliveries[0]!.error).toContain('VAPID');
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('sends the payload encrypted to the subscription', async () => {
    sendNotification.mockResolvedValue({ statusCode: 201 });
    const transport = new WebPushTransport({ publicKey: 'pub', privateKey: 'priv' });
    const result = await transport.send([target()], { ...MESSAGE, deepLink: '/tips/1' });

    expect(result.sent).toBe(1);
    const [subscription, payload] = sendNotification.mock.calls[0]!;
    expect((subscription as { endpoint: string }).endpoint).toBe('https://push.example.test/abc');
    expect(JSON.parse(payload as string)).toMatchObject({
      title: 'New analysis',
      deepLink: '/tips/1',
    });
  });

  it('ignores targets belonging to another transport', async () => {
    const transport = new WebPushTransport({ publicKey: 'pub', privateKey: 'priv' });
    const result = await transport.send(
      [{ token: 'ExponentPushToken[x]', provider: 'EXPO', platform: 'IOS' }],
      MESSAGE,
    );
    expect(result.deliveries).toHaveLength(0);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('marks a gone subscription as unregistered so the token is dropped', async () => {
    sendNotification.mockRejectedValue(Object.assign(new Error('Gone'), { statusCode: 410 }));
    const transport = new WebPushTransport({ publicKey: 'pub', privateKey: 'priv' });
    const result = await transport.send([target()], MESSAGE);
    expect(result.failed).toBe(1);
    expect(result.deliveries[0]!.unregistered).toBe(true);
  });

  it('keeps a token that failed for a transient reason', async () => {
    sendNotification.mockRejectedValue(Object.assign(new Error('Boom'), { statusCode: 500 }));
    const transport = new WebPushTransport({ publicKey: 'pub', privateKey: 'priv' });
    const result = await transport.send([target()], MESSAGE);
    expect(result.deliveries[0]!.unregistered).toBe(false);
  });

  it('treats a token that is not a subscription as dead', async () => {
    const transport = new WebPushTransport({ publicKey: 'pub', privateKey: 'priv' });
    const result = await transport.send([target('not-json')], MESSAGE);
    expect(result.deliveries[0]!.unregistered).toBe(true);
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
