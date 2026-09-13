'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { CloudOff, RefreshCw, ServerCrash, SearchX } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { Button, EmptyState } from './primitives';

/** Offline banner driven by the browser's connectivity state. */
export function OfflineBanner(): ReactNode {
  const t = useT();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = (): void => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-md bg-gold-400/15 px-3 py-2 text-[12px] text-gold-300"
    >
      <CloudOff size={15} aria-hidden />
      <span>
        <strong className="font-bold">{t('feed.offlineTitle')}</strong> — {t('feed.offlineBody')}
      </span>
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}): ReactNode {
  const t = useT();
  const status = (error as { status?: number }).status ?? 0;
  const code = (error as { code?: string }).code ?? '';

  const message =
    status === 0 || code === 'NETWORK_ERROR'
      ? t('error.network')
      : status === 401
        ? t('error.unauthorized')
        : status === 403
          ? t('error.forbidden')
          : status === 404
            ? t('error.notFound')
            : status === 429
              ? t('error.rateLimited')
              : status >= 500
                ? t('error.serverBody')
                : ((error as Error).message ?? t('error.generic'));

  return (
    <EmptyState
      icon={<ServerCrash size={28} aria-hidden />}
      title={status >= 500 ? t('error.serverTitle') : t('feed.errorTitle')}
      body={message}
      action={
        onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw size={14} aria-hidden /> {t('common.retry')}
          </Button>
        ) : undefined
      }
    />
  );
}

export function NoResults({ title, body }: { title?: string; body?: string }): ReactNode {
  const t = useT();
  return (
    <EmptyState
      icon={<SearchX size={28} aria-hidden />}
      title={title ?? t('feed.emptyTitle')}
      body={body ?? t('feed.emptyBody')}
    />
  );
}

export function ResponsibleGamblingNote(): ReactNode {
  const t = useT();
  return (
    <p className="mt-6 rounded-md border border-line-subtle px-3 py-2 text-center text-[11px] leading-relaxed text-ink-dim">
      {t('legal.ageNotice')} {t('legal.noGuarantee')}
    </p>
  );
}
