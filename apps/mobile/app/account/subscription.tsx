import type { ReactNode } from 'react';
import { Alert, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import type { PaymentDTO, Paginated, SubscriptionDTO } from '@profit-tips/types';
import { formatDateTime } from '@profit-tips/ui';
import { theme } from '@/lib/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Card, ListRow, Screen, SectionTitle } from '@/components/layout';
import { Button, EmptyState, ErrorState, Skeleton } from '@/components/primitives';
import { restorePurchases } from '@/lib/purchases';

const { colors, fontSize, spacing } = theme;

const STORE_URL =
  Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';

export default function SubscriptionScreen(): ReactNode {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { user, refresh } = useAuth();
  const queryClient = useQueryClient();

  const subscriptions = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => api<{ items: SubscriptionDTO[] }>('/me/subscriptions'),
    enabled: Boolean(user),
  });

  const payments = useQuery({
    queryKey: ['payments'],
    queryFn: () => api<Paginated<PaymentDTO>>('/me/payments?limit=10'),
    enabled: Boolean(user),
  });

  const cancel = useMutation({
    mutationFn: (subscriptionId: string) =>
      api('/billing/subscriptions/cancel', {
        method: 'POST',
        body: { subscriptionId, immediate: false },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      await refresh();
      Alert.alert(t('subscription.title'), t('subscription.cancelled'));
    },
    onError: (error: Error) => Alert.alert(t('error.generic'), error.message),
  });

  async function openPortal(): Promise<void> {
    try {
      const response = await api<{ url: string }>('/billing/portal', { method: 'POST' });
      await WebBrowser.openBrowserAsync(response.url);
      await refresh();
    } catch (error) {
      Alert.alert(t('error.generic'), (error as Error).message);
    }
  }

  async function restore(): Promise<void> {
    try {
      const count = await restorePurchases();
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      Alert.alert(
        t('paywall.restore'),
        count > 0 ? t('paywall.restoreSuccess') : t('paywall.restoreEmpty'),
      );
    } catch (error) {
      Alert.alert(t('error.generic'), (error as Error).message);
    }
  }

  if (!user) {
    return (
      <Screen title={t('subscription.title')} back>
        <Card style={{ marginTop: spacing[6], gap: spacing[3] }}>
          <Text style={styles.body}>{t('poll.loginRequired')}</Text>
          <Button label={t('auth.login')} onPress={() => router.push('/auth/login')} />
        </Card>
      </Screen>
    );
  }

  const items = subscriptions.data?.items ?? [];

  return (
    <Screen title={t('subscription.title')} back>
      {subscriptions.isPending ? (
        <View style={{ paddingTop: spacing[4] }}>
          <Skeleton height={140} />
        </View>
      ) : subscriptions.isError ? (
        <ErrorState
          message={(subscriptions.error as Error).message}
          onRetry={() => void subscriptions.refetch()}
        />
      ) : items.length === 0 ? (
        <Card style={{ marginTop: spacing[4], gap: spacing[3] }}>
          <Text style={styles.body}>{t('subscription.none')}</Text>
          <Button label={t('paywall.getCombo')} variant="gold" onPress={() => router.push('/paywall/combo')} />
        </Card>
      ) : (
        items.map((subscription) => (
          <Card key={subscription.id} style={{ marginTop: spacing[4] }}>
            <Text style={styles.planName}>
              {subscription.plan?.name ?? subscription.products.join(' · ')}
            </Text>
            <View style={{ marginTop: spacing[2] }}>
              <ListRow label={t('subscription.status')} value={subscription.status} />
              <ListRow label={t('profile.account')} value={subscription.provider} />
              {subscription.currentPeriodEnd ? (
                <ListRow
                  label={
                    subscription.willRenew ? t('subscription.renewsOn') : t('subscription.expiresOn')
                  }
                  value={formatDateTime(subscription.currentPeriodEnd, undefined, locale)}
                />
              ) : null}
              {subscription.daysRemaining !== null ? (
                <ListRow
                  label={t('subscription.daysRemaining')}
                  value={String(subscription.daysRemaining)}
                />
              ) : null}
            </View>

            {subscription.cancelAtPeriodEnd ? (
              <Text style={styles.notice}>{t('subscription.willNotRenew')}</Text>
            ) : null}

            <View style={{ marginTop: spacing[3], gap: spacing[2] }}>
              {subscription.provider === 'STRIPE' ? (
                <>
                  <Button label={t('subscription.manage')} variant="outline" onPress={() => void openPortal()} />
                  {!subscription.cancelAtPeriodEnd ? (
                    <Button
                      label={t('subscription.cancel')}
                      variant="danger"
                      loading={cancel.isPending}
                      onPress={() =>
                        Alert.alert(t('subscription.cancel'), t('subscription.cancelConfirm'), [
                          { text: t('common.cancel'), style: 'cancel' },
                          {
                            text: t('subscription.cancel'),
                            style: 'destructive',
                            onPress: () => cancel.mutate(subscription.id),
                          },
                        ])
                      }
                    />
                  ) : null}
                </>
              ) : (
                <Button
                  label={t('subscription.manage')}
                  variant="outline"
                  onPress={() => void Linking.openURL(STORE_URL)}
                />
              )}
            </View>
          </Card>
        ))
      )}

      <Button
        label={t('paywall.restore')}
        variant="ghost"
        onPress={() => void restore()}
        style={{ marginTop: spacing[3] }}
      />

      <SectionTitle>{t('subscription.history')}</SectionTitle>
      <Card>
        {payments.isPending ? (
          <Skeleton height={60} />
        ) : payments.isError || payments.data.items.length === 0 ? (
          <EmptyState title={t('subscription.none')} />
        ) : (
          payments.data.items.map((payment) => (
            <ListRow
              key={payment.id}
              label={payment.description ?? payment.provider}
              value={`${payment.amount.formatted} · ${payment.status}`}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.text.secondary, fontSize: fontSize.md },
  planName: { color: colors.text.primary, fontSize: fontSize.lg, fontWeight: '800' },
  notice: { marginTop: spacing[2], color: colors.gold.DEFAULT, fontSize: fontSize.sm },
});
