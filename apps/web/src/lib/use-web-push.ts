'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

interface PushConfig {
  enabled: boolean;
  publicKey: string | null;
}

export type PushState =
  | 'unsupported' // no service worker or no Push API in this browser
  | 'unconfigured' // the server has no VAPID pair, so nothing can be sent
  | 'denied' // the reader refused, and only they can undo that
  | 'off'
  | 'on'
  | 'working';

/**
 * The VAPID public key travels as base64url text and has to reach
 * `pushManager.subscribe` as raw bytes.
 */
function decodeKey(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = window.atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

/** Rejects rather than hanging when the browser's push service never answers. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Push subscription timed out')), ms);
    }),
  ]).finally(() => clearTimeout(timer!)) as Promise<T>;
}

/**
 * Browser notifications for a signed-in reader.
 *
 * The subscription belongs to the browser, not to the account, so it is
 * registered as a device token exactly like a phone's: the same fan-out, the
 * same per-type preferences, the same deletion when the endpoint dies.
 *
 * Permission is only ever requested from a click. A page that asks on load is
 * refused by the reader and often by the browser, and a refusal is permanent
 * until they dig through site settings.
 */
export function useWebPush(): { state: PushState; toggle: () => Promise<void> } {
  const [state, setState] = useState<PushState>('working');
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  useEffect(() => {
    if (!supported) {
      setState('unsupported');
      return;
    }
    let cancelled = false;
    void (async () => {
      const config = await api<PushConfig>('/push/config', { auth: false }).catch(() => null);
      if (cancelled) return;
      if (!config?.enabled || !config.publicKey) {
        setState('unconfigured');
        return;
      }
      setPublicKey(config.publicKey);
      if (Notification.permission === 'denied') {
        setState('denied');
        return;
      }
      const registration = await navigator.serviceWorker.register('/sw.js');
      const existing = await registration.pushManager.getSubscription();
      if (cancelled) return;
      setState(existing ? 'on' : 'off');
    })();
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const toggle = useCallback(async () => {
    if (!supported || !publicKey) return;
    setState('working');
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const existing = await registration.pushManager.getSubscription();

      if (existing) {
        // Unregister on the server first: a subscription that is gone locally
        // but still stored would be pushed to forever.
        await api('/me/devices/deactivate', {
          method: 'POST',
          body: { token: JSON.stringify(existing) },
        }).catch(() => undefined);
        await existing.unsubscribe();
        setState('off');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }

      // `subscribe` talks to the browser's own push service, and when that
      // service is unreachable — a blocked network, a browser build without
      // one — the promise simply never settles. Without this the button spins
      // for as long as the page is open.
      const subscription = await withTimeout(
        registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeKey(publicKey) as BufferSource,
        }),
        15_000,
      );
      await api('/me/devices', {
        method: 'POST',
        body: {
          token: JSON.stringify(subscription),
          platform: 'WEB',
          provider: 'WEB_PUSH',
          deviceName: navigator.userAgent.slice(0, 80),
        },
      });
      setState('on');
    } catch {
      setState('off');
    }
  }, [supported, publicKey]);

  return { state, toggle };
}
