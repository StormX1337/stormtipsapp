import type { ReactNode } from 'react';
import { RefreshControl, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { TipDTO } from '@profit-tips/types';
import { theme } from '@/lib/theme';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Screen } from '@/components/layout';
import { TipCard, TipCardSkeleton } from '@/components/tip-card';
import { EmptyState, ErrorState } from '@/components/primitives';

const { spacing, colors } = theme;

/**
 * Live screen.
 *
 * Polls every 20 seconds; the API is the only source of scores and minutes, so
 * a stale client can never invent a result.
 */
export default function LiveScreen(): ReactNode {
  const { t } = useI18n();

  const query = useQuery({
    queryKey: ['live'],
    queryFn: () => api<{ items: TipDTO[] }>('/tips/live'),
    refetchInterval: 20_000,
  });

  return (
    <Screen
      title={t('live.title')}
      back
      refreshControl={
        <RefreshControl
          refreshing={query.isFetching && !query.isPending}
          tintColor={colors.text.secondary}
          onRefresh={() => void query.refetch()}
        />
      }
    >
      <View style={{ paddingTop: spacing[4] }}>
        {query.isPending ? (
          Array.from({ length: 4 }, (_, index) => <TipCardSkeleton key={index} />)
        ) : query.isError ? (
          <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} />
        ) : query.data.items.length === 0 ? (
          <EmptyState title={t('live.empty')} />
        ) : (
          query.data.items.map((tip) => <TipCard key={tip.id} tip={tip} />)
        )}
      </View>
    </Screen>
  );
}
