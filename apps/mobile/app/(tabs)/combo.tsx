import { useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ComboDTO, Paginated } from '@profit-tips/types';
import { theme, shared } from '@/lib/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { OfflineBanner, ScreenHeader } from '@/components/layout';
import { ComboCard } from '@/components/combo-card';
import { Paywall, type PaywallData } from '@/components/paywall';
import {
  EmptyState,
  ErrorState,
  ResponsibleGamblingNote,
  Skeleton,
} from '@/components/primitives';
import { ClockIcon } from '@/components/icons';

const { colors, fontSize, spacing } = theme;

/**
 * Combo screen.
 *
 * A subscriber sees the accumulators; everyone else sees the sales page — the
 * layout from the reference screenshot.
 */
export default function ComboScreen(): ReactNode {
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { has, ready, refresh } = useAuth();
  const [showSettled, setShowSettled] = useState(true);

  const unlocked = has('COMBO');

  const paywall = useQuery({
    queryKey: ['paywall', 'combo'],
    queryFn: () => api<PaywallData>('/billing/paywall/combo'),
    enabled: !unlocked,
  });

  const combos = useQuery({
    queryKey: ['combos', showSettled],
    queryFn: () =>
      api<Paginated<ComboDTO>>(`/tips/combo/groups?limit=20&includeSettled=${showSettled}`),
    enabled: unlocked,
  });

  const refreshing = unlocked ? combos.isFetching : paywall.isFetching;

  return (
    <View style={shared.screen}>
      <ScreenHeader
        title={t('nav.combo')}
        left={
          unlocked ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('nav.history')}
              hitSlop={8}
              onPress={() => router.push('/history?product=COMBO')}
            >
              <ClockIcon color={colors.text.secondary} />
            </Pressable>
          ) : null
        }
        right={
          unlocked ? null : (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.push('/account/subscription')}
            >
              <Text style={{ color: colors.text.muted, fontSize: fontSize.sm }}>
                {t('paywall.restore')}
              </Text>
            </Pressable>
          )
        }
      />

      <ScrollView
        contentContainerStyle={[shared.gutter, { paddingBottom: insets.bottom + spacing[8] }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.text.secondary}
            onRefresh={() => {
              void refresh();
              void (unlocked ? combos.refetch() : paywall.refetch());
            }}
          />
        }
      >
        <OfflineBanner />

        {!ready ? (
          <View style={{ paddingTop: spacing[4] }}>
            <Skeleton height={160} />
            <Skeleton height={96} />
          </View>
        ) : unlocked ? (
          <View style={{ paddingTop: spacing[3] }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowSettled((value) => !value)}
              style={{ alignSelf: 'flex-end', paddingVertical: spacing[2] }}
            >
              <Text style={{ color: colors.accent.DEFAULT, fontSize: fontSize.sm, fontWeight: '600' }}>
                {showSettled ? t('common.all') : t('status.PENDING')}
              </Text>
            </Pressable>

            {combos.isPending ? (
              Array.from({ length: 3 }, (_, index) => <Skeleton key={index} height={180} />)
            ) : combos.isError ? (
              <ErrorState
                message={(combos.error as Error).message}
                onRetry={() => void combos.refetch()}
              />
            ) : combos.data.items.length === 0 ? (
              <EmptyState title={t('feed.emptyTitle')} body={t('feed.emptyBody')} />
            ) : (
              combos.data.items.map((combo) => <ComboCard key={combo.id} combo={combo} />)
            )}

            <ResponsibleGamblingNote />
          </View>
        ) : paywall.isPending ? (
          <View style={{ paddingTop: spacing[4] }}>
            <Skeleton height={32} width="66%" />
            <Skeleton height={220} />
            <Skeleton height={96} />
          </View>
        ) : paywall.isError ? (
          <ErrorState
            message={(paywall.error as Error).message}
            onRetry={() => void paywall.refetch()}
          />
        ) : (
          <Paywall data={paywall.data} onPurchased={() => void combos.refetch()} />
        )}
      </ScrollView>
    </View>
  );
}
