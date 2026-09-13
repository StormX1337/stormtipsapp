'use client';

import { type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationPreferences, UserDTO } from '@profit-tips/types';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/navigation';
import { ErrorState } from '@/components/states';
import { Skeleton } from '@/components/primitives';

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
    <AppShell title={t('profile.notifications')}>
      <div id="main" className="py-4">
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
                  className="h-5 w-5 accent-[#12E17F]"
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
