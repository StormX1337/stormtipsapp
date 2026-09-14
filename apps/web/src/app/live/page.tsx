'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Radio } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { EventDTO, ServerMessage, TipDTO } from '@storm-tips/types';
import { WS_TOPICS } from '@storm-tips/types';
import { api, tokenStore } from '@/lib/api';
import { config } from '@/lib/config';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/navigation';
import { TipCard } from '@/components/tip-card';
import { ErrorState, NoResults, OfflineBanner } from '@/components/states';
import { Skeleton, TeamCrest } from '@/components/primitives';

function LiveMatchCard({ event }: { event: EventDTO }): ReactNode {
  return (
    <article className="card flex items-center gap-3 p-3">
      <span className="live-dot w-10 shrink-0 text-[12px] font-bold text-live">
        {event.minute ? `${event.minute}'` : event.status === 'HALFTIME' ? 'HT' : 'LIVE'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 py-0.5">
          <TeamCrest
            name={event.homeTeam.name}
            logoUrl={event.homeTeam.logoUrl}
            color={event.homeTeam.colorPrimary}
          />
          <span className="min-w-0 flex-1 truncate text-[13px]">
            {event.homeTeam.shortName ?? event.homeTeam.name}
          </span>
          <span className="tabular text-[14px] font-bold">{event.homeScore ?? 0}</span>
        </div>
        <div className="flex items-center gap-2 py-0.5">
          <TeamCrest
            name={event.awayTeam.name}
            logoUrl={event.awayTeam.logoUrl}
            color={event.awayTeam.colorPrimary}
          />
          <span className="min-w-0 flex-1 truncate text-[13px]">
            {event.awayTeam.shortName ?? event.awayTeam.name}
          </span>
          <span className="tabular text-[14px] font-bold">{event.awayScore ?? 0}</span>
        </div>
        <p className="mt-1 truncate text-[11px] text-ink-dim">{event.league.name}</p>
      </div>
    </article>
  );
}

/**
 * Live screen.
 *
 * Subscribes to the realtime gateway and falls back to 15-second polling when
 * the socket cannot be established (corporate proxies, flaky mobile networks).
 */
export default function LivePage(): ReactNode {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  const events = useQuery({
    queryKey: ['live-events'],
    queryFn: () => api<{ items: EventDTO[] }>('/events/live', { auth: false }),
    refetchInterval: connected ? false : 15_000,
  });

  const liveTips = useQuery({
    queryKey: ['live-tips'],
    queryFn: () => api<{ items: TipDTO[] }>('/tips/live'),
    refetchInterval: connected ? false : 20_000,
  });

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket;

    // Without a configured socket URL the screen polls instead. Opening a
    // connection that cannot succeed would only add reconnect noise.
    if (!config.wsUrl) return;

    try {
      socket = new WebSocket(config.wsUrl);
    } catch {
      return;
    }
    socketRef.current = socket;

    socket.addEventListener('open', () => {
      if (cancelled) return;
      setConnected(true);
      const token = tokenStore.access;
      if (token) socket.send(JSON.stringify({ type: 'auth', token }));
      socket.send(
        JSON.stringify({
          type: 'subscribe',
          topics: [WS_TOPICS.liveEvents, WS_TOPICS.tipsFree, WS_TOPICS.tipsVip],
        }),
      );
    });

    socket.addEventListener('message', (message) => {
      try {
        const payload = JSON.parse(String(message.data)) as ServerMessage;
        if (payload.type === 'event.update' || payload.type === 'tip.settled') {
          void queryClient.invalidateQueries({ queryKey: ['live-events'] });
          void queryClient.invalidateQueries({ queryKey: ['live-tips'] });
        }
      } catch {
        // Ignore malformed frames rather than breaking the screen.
      }
    });

    socket.addEventListener('close', () => setConnected(false));
    socket.addEventListener('error', () => setConnected(false));

    return () => {
      cancelled = true;
      socket.close();
      socketRef.current = null;
    };
  }, [queryClient]);

  return (
    <AppShell
      title={t('live.title')}
      left={
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-md text-ink-muted hover:bg-bg-card hover:text-ink"
        >
          <ChevronLeft size={22} aria-hidden />
        </button>
      }
      right={
        <span
          className={connected ? 'text-accent-500' : 'text-ink-dim'}
          title={connected ? 'Live' : t('live.reconnecting')}
        >
          <Radio size={18} aria-hidden />
        </span>
      }
    >
      <div id="main" className="flex flex-col gap-3 py-4">
        <OfflineBanner />

        {events.isPending ? (
          Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-24 w-full" />)
        ) : events.isError ? (
          <ErrorState error={events.error} onRetry={() => void events.refetch()} />
        ) : events.data.items.length === 0 ? (
          <NoResults title={t('live.empty')} body="" />
        ) : (
          events.data.items.map((event) => <LiveMatchCard key={event.id} event={event} />)
        )}

        {liveTips.data && liveTips.data.items.length > 0 ? (
          <section className="mt-2">
            <h2 className="px-1 pb-2 text-[13px] font-bold">
              {t('nav.live')} · {t('nav.free')}
            </h2>
            <div className="flex flex-col gap-2">
              {liveTips.data.items.map((tip) => (
                <TipCard key={tip.id} tip={tip} href={`/tips/${tip.id}`} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
