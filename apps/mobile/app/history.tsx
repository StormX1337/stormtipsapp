import { useState, type ReactNode } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { MessageKey } from '@profit-tips/ui';
import type { Paginated, ProductCode, TipDTO, TipOutcome } from '@profit-tips/types';
import { formatShortDate } from '@profit-tips/ui';
import { theme, shared } from '@/lib/theme';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Screen } from '@/components/layout';
import { Segmented } from '@/components/form';
import {
  Button,
  EmptyState,
  ErrorState,
  OddsText,
  Skeleton,
  StatusBadge,
} from '@/components/primitives';

const { colors, fontSize, spacing } = theme;

const PRODUCTS: (ProductCode | 'ALL')[] = ['ALL', 'FREE', 'VIP', 'EXTRA', 'COMBO'];
const OUTCOMES: (TipOutcome | 'ALL')[] = ['ALL', 'WON', 'LOST', 'VOID'];

/** Verified results archive — public by design so the numbers can be checked. */
export default function HistoryScreen(): ReactNode {
  const params = useLocalSearchParams<{ product?: string }>();
  const { t, locale } = useI18n();

  const [product, setProduct] = useState<ProductCode | 'ALL'>(
    (params.product as ProductCode | undefined) ?? 'ALL',
  );
  const [outcome, setOutcome] = useState<TipOutcome | 'ALL'>('ALL');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['history', product, outcome, page],
    queryFn: () => {
      const search = new URLSearchParams({ page: String(page), limit: '25' });
      if (product !== 'ALL') search.set('product', product);
      if (outcome !== 'ALL') search.set('outcome', outcome);
      return api<Paginated<TipDTO>>(`/tips/history?${search.toString()}`);
    },
  });

  function reset<T>(setter: (value: T) => void): (value: T) => void {
    return (value) => {
      setPage(1);
      setter(value);
    };
  }

  return (
    <Screen
      title={t('nav.history')}
      back
      refreshControl={
        <RefreshControl
          refreshing={query.isFetching && !query.isPending}
          tintColor={colors.text.secondary}
          onRefresh={() => void query.refetch()}
        />
      }
    >
      <View style={{ paddingTop: spacing[3], gap: spacing[2] }}>
        <Segmented
          options={PRODUCTS.map((code) => ({
            value: code,
            label: code === 'ALL' ? t('common.all') : t(`product.${code}` as MessageKey),
          }))}
          value={product}
          onChange={reset(setProduct)}
        />
        <Segmented
          options={OUTCOMES.map((code) => ({
            value: code,
            label: code === 'ALL' ? t('common.all') : t(`status.${code}` as MessageKey),
          }))}
          value={outcome}
          onChange={reset(setOutcome)}
        />
      </View>

      <View style={{ paddingTop: spacing[4] }}>
        {query.isPending ? (
          Array.from({ length: 8 }, (_, index) => <Skeleton key={index} height={54} />)
        ) : query.isError ? (
          <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} />
        ) : query.data.items.length === 0 ? (
          <EmptyState title={t('feed.emptyTitle')} body={t('feed.emptyBody')} />
        ) : (
          <>
            {query.data.items.map((tip) => (
              <View key={tip.id} style={[shared.card, styles.row]}>
                <Text style={styles.date}>
                  {formatShortDate(tip.settledAt ?? tip.event.startsAt, undefined, locale)}
                </Text>
                <View style={styles.rowBody}>
                  <Text numberOfLines={1} style={styles.match}>
                    {tip.event.homeTeam.shortName ?? tip.event.homeTeam.name} –{' '}
                    {tip.event.awayTeam.shortName ?? tip.event.awayTeam.name}
                  </Text>
                  <Text numberOfLines={1} style={styles.selection}>
                    {tip.isLocked ? t('feed.lockedTitle') : (tip.selectionLabel ?? tip.marketName)}
                  </Text>
                </View>
                <OddsText odds={tip.odds} locked={tip.isLocked} size="sm" />
                <StatusBadge outcome={tip.outcome} />
              </View>
            ))}

            <View style={styles.pager}>
              <Button
                label={t('common.back')}
                variant="outline"
                disabled={page === 1}
                onPress={() => setPage((current) => Math.max(1, current - 1))}
                style={{ flex: 1 }}
              />
              <Text style={styles.pageLabel}>
                {query.data.page} / {query.data.totalPages}
              </Text>
              <Button
                label={t('common.next')}
                variant="outline"
                disabled={!query.data.hasNext}
                onPress={() => setPage((current) => current + 1)}
                style={{ flex: 1 }}
              />
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  date: { width: 46, color: colors.text.muted, fontSize: fontSize.xs },
  rowBody: { flex: 1, minWidth: 0 },
  match: { color: colors.text.primary, fontSize: fontSize.base },
  selection: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
  },
  pager: {
    marginTop: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  pageLabel: { color: colors.text.muted, fontSize: fontSize.sm },
});
