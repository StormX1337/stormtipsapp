'use client';

import { type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationPreferences, UserDTO } from '@storm-tips/types';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/navigation';
import { ErrorState } from '@/components/states';
import { Button, Skeleton } from '@/components/primitives';
import { useWebPush } from '@/lib/use-web-push';

const KEYS: (keyof NotificationPreferences)[] = [
  'newTips',
  'vipTips',
  'comboTips',
  'extraTips',
  'fixOddsTips',
  'results',
  'kickoffReminders',
  'subscription',
  'promotions',
  'polls',
];

/**
 * Notifications from the browser itself.
 *
 * Separate from the per-type switches below, because it answers a different
 * question: those decide what is worth sending, this decides whether this
 * browser can receive anything at all. Granting it here, from a button, is the
 * only way a browser will ask — and a refusal sticks until the reader changes
 * it in the site settings themselves, which is why the refused state says so
 * rather than offering the button again.
 */
function BrowserNotifications(): ReactNode {
  const { t } = useI18n();
  const { state, toggle } = useWebPush();

  if (state === 'unsupported' || state === 'unconfigured') return null;

  return (
    <section className="card flex items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold">{t('push.title')}</p>
        <p className="mt-0.5 text-[12px] text-ink-muted">
          {state === 'denied' ? t('push.denied') : t('push.body')}
        </p>
      </div>
      {state === 'denied' ? null : (
        <Button
          size="sm"
          variant={state === 'on' ? 'outline' : 'primary'}
          loading={state === 'working'}
          onClick={() => void toggle()}
        >
          {state === 'on' ? t('push.disable') : t('push.enable')}
        </Button>
      )}
    </section>
  );
}

export default function NotificationSettingsPage(): ReactNode {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const profile = useQuery({ queryKey: ['me'], queryFn: () => api<UserDTO>('/me') });

  const update = useMutation({
    mutationFn: (prefs: Partial<NotificationPreferences>) =>
      api<UserDTO>('/me', { method: 'PATCH', body: { notificationPrefs: prefs } }),
    onSuccess: (user) => queryClient.setQueryData(['me'], user),
  });

  return (
    <AppShell measure="narrow" title={t('profile.notifications')}>
      <div id="main" className="flex flex-col gap-3 py-4">
        <BrowserNotifications />
        {profile.isPending ? (
          <Skeleton className="h-80 w-full" />
        ) : profile.isError ? (
          <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
        ) : (
          <section className="card divide-y divide-line-subtle overflow-hidden">
            {KEYS.map((key) => (
              <label key={key} className="flex cursor-pointer items-center gap-3 px-3 py-3">
                <span className="flex-1 text-[13.5px]">{t(`notifications.${key}` as never)}</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-accent-500"
                  checked={profile.data.notificationPrefs[key]}
                  onChange={(event) => update.mutate({ [key]: event.target.checked })}
                  disabled={update.isPending}
                />
              </label>
            ))}
          </section>
        )}
      </div>
    </AppShell>
  );
}
