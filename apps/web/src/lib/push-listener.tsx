'use client';

import { useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Keeps an open tab in step with a push it just received.
 *
 * Without this, a notification saying a new analysis is out sits on top of a
 * feed that does not contain it until the reader reloads — which makes the
 * product look slower than it is. The service worker tells every open tab, and
 * the tab refetches the lists that could have changed.
 */
export function PushListener(): ReactNode {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    function onMessage(event: MessageEvent): void {
      const data = event.data as { source?: string; type?: string } | null;
      if (data?.source !== 'storm-tips' || data.type !== 'push') return;
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['record'] });
    }

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [queryClient]);

  return null;
}
