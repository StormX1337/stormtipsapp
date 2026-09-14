import type { ReactNode } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import type { ReferralSummaryDTO } from '@storm-tips/types';
import { theme } from '@/lib/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Card, ListRow, Screen, SectionTitle } from '@/components/layout';
import { StatGrid, StatTile } from '@/components/stat-tiles';
import { Button, ErrorState, Skeleton } from '@/components/primitives';

const { colors, fontSize, spacing } = theme;

export default function ReferralsScreen(): ReactNode {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['referrals'],
    queryFn: () => api<ReferralSummaryDTO>('/me/referrals'),
    enabled: Boolean(user),
  });

  if (!user) {
    return (
      <Screen title={t('referral.title')} back>
        <Card style={{ marginTop: spacing[6], gap: spacing[3] }}>
          <Text style={styles.body}>{t('poll.loginRequired')}</Text>
          <Button label={t('auth.login')} onPress={() => router.push('/auth/login')} />
        </Card>
      </Screen>
    );
  }

  const data = query.data;

  return (
    <Screen title={t('referral.title')} back>
      {query.isPending ? (
        <View style={{ paddingTop: spacing[4] }}>
          <Skeleton height={140} />
        </View>
      ) : query.isError || !data ? (
        <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <Card style={{ marginTop: spacing[4] }}>
            <Text style={styles.label}>{t('referral.yourCode')}</Text>
            <Text style={styles.code} selectable>
              {data.code}
            </Text>

            <View style={{ marginTop: spacing[3], gap: spacing[2] }}>
              <Button
                label={t('common.copy')}
                variant="outline"
                onPress={() => {
                  void (async () => {
                    await Clipboard.setStringAsync(data.link);
                    Alert.alert(t('common.copied'), data.link);
                  })();
                }}
              />
              <Button
                label={t('common.share')}
                onPress={() => {
                  void Share.share({ message: `${t('referral.explain')} ${data.link}` });
                }}
              />
            </View>

            <Text style={styles.explain}>{t('referral.explain')}</Text>
          </Card>

          <SectionTitle>{t('referral.invited')}</SectionTitle>
          <StatGrid>
            <StatTile label={t('referral.invited')} value={String(data.totalReferrals)} />
            <StatTile
              label={t('referral.qualified')}
              value={String(data.qualifiedReferrals)}
              tone="positive"
            />
            <StatTile
              label={t('referral.rewards')}
              value={String(data.rewardedReferrals)}
              tone="gold"
            />
            <StatTile label={t('status.PENDING')} value={String(data.pendingReferrals)} />
          </StatGrid>

          {data.rewards.length > 0 ? (
            <>
              <SectionTitle>{t('referral.rewards')}</SectionTitle>
              <Card>
                {data.rewards.map((reward) => (
                  <ListRow
                    key={reward.id}
                    label={reward.type}
                    value={
                      reward.days !== null
                        ? `${reward.days} · ${reward.status}`
                        : (reward.amount?.formatted ?? reward.status)
                    }
                  />
                ))}
              </Card>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.text.secondary, fontSize: fontSize.md },
  label: { color: colors.text.muted, fontSize: fontSize.sm },
  code: {
    marginTop: spacing[1],
    color: colors.accent.DEFAULT,
    fontSize: fontSize['3xl'],
    fontWeight: '800',
    letterSpacing: 2,
  },
  explain: {
    marginTop: spacing[3],
    color: colors.text.muted,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.6,
  },
});
