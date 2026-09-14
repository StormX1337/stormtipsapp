import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MessageKey } from '@storm-tips/ui';
import type { ProductCode, PromotionDTO, TipFeedDTO } from '@storm-tips/types';
import { toDateKey } from '@storm-tips/ui';
import { theme, shared } from '@/lib/theme';
import { api } from '@/lib/api';
import { cache } from '@/lib/storage';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { ScreenHeader, OfflineBanner } from './layout';
import { DateStrip } from './date-strip';
import { PromoBanner } from './promo-banner';
import { LeagueHeader, TipCard, TipCardSkeleton } from './tip-card';
import { Button, EmptyState, ErrorState, ResponsibleGamblingNote } from './primitives';
import { BallIcon, ChartIcon, LockIcon } from './icons';

const { colors, fontSize, radii, spacing } = theme;

export const PATH_BY_PRODUCT: Record<ProductCode, string> = {
  FREE: 'free',
  VIP: 'vip',
  EXTRA: 'extra',
  COMBO: 'combo',
  FIX_ODDS: 'fix-odds',
};

const CTA_KEY: Record<ProductCode, MessageKey> = {
  FREE: 'paywall.getVip',
  VIP: 'paywall.getVip',
  EXTRA: 'paywall.getExtra',
  COMBO: 'paywall.getCombo',
  FIX_ODDS: 'paywall.getFixOdds',
};

/**
 * The product feed screen.
 *
 * One component drives Free, VIP, Extra and Fix Odds. Premium products add the
 * unlock strip above the list; the tips themselves arrive already masked from
 * the server, so nothing premium is ever in the client's hands.
 */
export function ProductFeed({
  product,
  title,
}: {
  product: ProductCode;
  title: string;
}): ReactNode {
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { has, ready } = useAuth();
  const [date, setDate] = useState(() => toDateKey(new Date()));

  const unlocked = has(product);
  const path = PATH_BY_PRODUCT[product];
  const cacheKey = `feed.${product}.${date}`;

  const feed = useQuery({
    queryKey: ['feed', product, date, unlocked],
    queryFn: async () => {
      const data = await api<TipFeedDTO>(`/tips/${path}?date=${date}`);
      void cache.write(cacheKey, data);
      return data;
    },
    // Last known feed keeps the screen useful in a tunnel or on a plane.
    initialData: undefined,
    placeholderData: (previous) => previous,
    // Only while a fixture is actually in play — see the web feed for why.
    refetchInterval: (query) =>
      query.state.data?.groups.some((group) =>
        group.tips.some((tip) => tip.event.status === 'LIVE' || tip.event.status === 'HALFTIME'),
      )
        ? 30_000
        : false,
  });

  const [offlineFeed, setOfflineFeed] = useState<TipFeedDTO | null>(null);
  useEffect(() => {
    if (!feed.isError) return;
    void cache.read<TipFeedDTO>(cacheKey).then((entry) => setOfflineFeed(entry?.value ?? null));
  }, [feed.isError, cacheKey]);

  const promotions = useQuery({
    queryKey: ['promotions', unlocked],
    queryFn: () => api<{ items: PromotionDTO[] }>('/billing/promotions'),
    staleTime: 5 * 60_000,
  });

  // Refresh when the app returns to the foreground.
  const refetch = feed.refetch;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refetch();
    });
    return () => subscription.remove();
  }, [refetch]);

  const onRefresh = useCallback(() => {
    void feed.refetch();
    void promotions.refetch();
  }, [feed, promotions]);

  const banner = promotions.data?.items[0];
  const data = feed.data ?? offlineFeed;

  return (
    <View style={shared.screen}>
      <ScreenHeader
        title={title}
        left={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('live.title')}
            hitSlop={8}
            onPress={() => router.push('/live')}
          >
            <BallIcon color={colors.text.secondary} />
          </Pressable>
        }
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('stats.title')}
            hitSlop={8}
            onPress={() => router.push('/statistics')}
          >
            <ChartIcon color={colors.text.secondary} />
          </Pressable>
        }
      />

      <ScrollView
        stickyHeaderIndices={[1]}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[8] }}
        refreshControl={
          <RefreshControl
            refreshing={feed.isFetching && !feed.isPending}
            onRefresh={onRefresh}
            tintColor={colors.text.secondary}
          />
        }
      >
        <View style={shared.gutter}>
          <OfflineBanner />
          {banner ? <PromoBanner promotion={banner} /> : null}
        </View>

        <DateStrip value={date} onChange={setDate} />

        <View style={[shared.gutter, { paddingTop: spacing[3] }]}>
          {!unlocked && ready && product !== 'FREE' ? (
            <View style={styles.unlock}>
              <LockIcon size={18} color={colors.gold[300]} />
              <Text style={styles.unlockText}>
                {t('feed.lockedBody', { product: t(`product.${product}` as MessageKey) })}
              </Text>
              <Button
                label={t(CTA_KEY[product])}
                variant="gold"
                onPress={() => router.push(`/paywall/${path}`)}
                style={styles.unlockButton}
              />
            </View>
          ) : null}

          {feed.isPending && !data ? (
            <View style={{ paddingTop: spacing[3] }}>
              {Array.from({ length: 5 }, (_, index) => (
                <TipCardSkeleton key={index} />
              ))}
            </View>
          ) : feed.isError && !data ? (
            <ErrorState
              message={(feed.error as Error).message}
              onRetry={() => void feed.refetch()}
            />
          ) : !data || data.groups.length === 0 ? (
            <EmptyState title={t('feed.emptyTitle')} body={t('feed.emptyBody')} />
          ) : (
            data.groups.map((group) => (
              <View key={group.league.id}>
                <LeagueHeader group={group} />
                {group.tips.map((tip) => (
                  <TipCard key={tip.id} tip={tip} />
                ))}
              </View>
            ))
          )}

          <ResponsibleGamblingNote />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  unlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.gold,
    backgroundColor: colors.gold.soft,
    padding: spacing[3],
  },
  unlockText: { flex: 1, color: colors.gold[100], fontSize: fontSize.sm, lineHeight: 17 },
  unlockButton: { minHeight: 34, paddingHorizontal: spacing[3] },
});
