import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MessageKey } from '@profit-tips/ui';
import type {
  NotificationDTO,
  NotificationPreferences,
  Paginated,
  UserDTO,
} from '@profit-tips/types';
import { formatRelative } from '@profit-tips/ui';
import { theme } from '@/lib/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Card, Screen, SectionTitle } from '@/components/layout';
import { ToggleRow } from '@/components/form';
import { Button, EmptyState, Skeleton } from '@/components/primitives';
import { registerPushToken } from '@/lib/notifications';

const { colors, fontSize, spacing } = theme;

const PREF_LABEL: Record<keyof NotificationPreferences, MessageKey> = {
  newTips: 'notifications.newTips',
  vipTips: 'notifications.vipTips',
  comboTips: 'notifications.comboTips',
  extraTips: 'notifications.extraTips',
  fixOddsTips: 'notifications.fixOddsTips',
  results: 'notifications.results',
  kickoffReminders: 'notifications.kickoffReminders',
  subscription: 'notifications.subscription',
  promotions: 'notifications.promotions',
  polls: 'notifications.polls',
};

export default function NotificationsScreen(): ReactNode {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { user, refresh } = useAuth();
  const queryClient = useQueryClient();

  const [prefs, setPrefs] = useState<NotificationPreferences | null>(
    user?.notificationPrefs ?? null,
  );
  useEffect(() => {
    if (user) setPrefs(user.notificationPrefs);
  }, [user]);

  const save = useMutation({
    mutationFn: (next: Partial<NotificationPreferences>) =>
      api<UserDTO>('/me', { method: 'PATCH', body: { notificationPrefs: next } }),
    onSuccess: () => void refresh(),
  });

  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<Paginated<NotificationDTO>>('/me/notifications?limit=20'),
    enabled: Boolean(user),
  });

  const markAll = useMutation({
    mutationFn: () => api('/me/notifications/read-all', { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  if (!user || !prefs) {
    return (
      <Screen title={t('profile.notifications')} back>
        <Card style={{ marginTop: spacing[6], gap: spacing[3] }}>
          <Text style={styles.body}>{t('poll.loginRequired')}</Text>
          <Button label={t('auth.login')} onPress={() => router.push('/auth/login')} />
        </Card>
      </Screen>
    );
  }

  function toggle(key: keyof NotificationPreferences, value: boolean): void {
    setPrefs((current) => (current ? { ...current, [key]: value } : current));
    save.mutate({ [key]: value });
    // Turning anything on is a good moment to make sure the device is known.
    if (value) void registerPushToken();
  }

  return (
    <Screen title={t('profile.notifications')} back>
      <SectionTitle>{t('profile.preferences')}</SectionTitle>
      <Card>
        {(Object.keys(PREF_LABEL) as (keyof NotificationPreferences)[]).map((key) => (
          <ToggleRow
            key={key}
            label={t(PREF_LABEL[key])}
            value={prefs[key]}
            onValueChange={(value) => toggle(key, value)}
          />
        ))}
      </Card>

      <SectionTitle>{t('nav.notifications')}</SectionTitle>
      <Card>
        {notifications.isPending ? (
          <Skeleton height={60} />
        ) : notifications.isError || notifications.data.items.length === 0 ? (
          <EmptyState title={t('notifications.empty')} />
        ) : (
          <>
            {notifications.data.items.map((item) => (
              <View key={item.id} style={styles.notification}>
                <View style={styles.notificationHeader}>
                  <Text numberOfLines={1} style={styles.notificationTitle}>
                    {item.title}
                  </Text>
                  {!item.readAt ? <View style={styles.unreadDot} /> : null}
                </View>
                <Text style={styles.notificationBody}>{item.body}</Text>
                <Text style={styles.notificationTime}>
                  {formatRelative(item.sentAt ?? item.createdAt, locale)}
                </Text>
              </View>
            ))}
            <Button
              label={t('notifications.markAllRead')}
              variant="ghost"
              loading={markAll.isPending}
              onPress={() => markAll.mutate()}
              style={{ marginTop: spacing[2] }}
            />
          </>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.text.secondary, fontSize: fontSize.md },
  notification: {
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  notificationHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  notificationTitle: {
    flex: 1,
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent.DEFAULT },
  notificationBody: { marginTop: 2, color: colors.text.secondary, fontSize: fontSize.base },
  notificationTime: { marginTop: spacing[1], color: colors.text.muted, fontSize: fontSize.xs },
});
