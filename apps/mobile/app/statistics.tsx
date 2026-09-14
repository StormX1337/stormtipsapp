import { useState, type ReactNode } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { MessageKey } from '@profit-tips/ui';
import type { ProductCode, StatisticsDTO, StatsWindow } from '@profit-tips/types';
import { formatPercent, formatSignedUnits } from '@profit-tips/ui';
import { theme } from '@/lib/theme';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Card, Screen, SectionTitle } from '@/components/layout';
import { Segmented } from '@/components/form';
import { BarRow, StatGrid, StatTile } from '@/components/stat-tiles';
import { ErrorState, Skeleton } from '@/components/primitives';

const { colors, fontSize, radii, spacing } = theme;

const WINDOWS: StatsWindow[] = ['D7', 'D30', 'D90', 'M6', 'M12', 'ALL'];
const PRODUCTS: (ProductCode | 'ALL')[] = ['ALL', 'FREE', 'VIP', 'EXTRA', 'COMBO'];

/** Cumulative-profit sparkline, drawn with plain views — no chart dependency. */
function ProfitSparkline({ points }: { points: { cumulativeProfit: number }[] }): ReactNode {
  if (points.length < 2) return null;
  const values = points.map((point) => point.cumulativeProfit);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const span = max - min || 1;

  return (
    <View style={styles.sparkline}>
      {values.map((value, index) => (
        <View
          key={index}
          style={[
            styles.sparkBar,
            {
              height: Math.max(2, ((value - min) / span) * 64),
              backgroundColor: value >= 0 ? colors.accent.DEFAULT : colors.status.LOST,
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function StatisticsScreen(): ReactNode {
  const { t, locale } = useI18n();
  const [windowKey, setWindowKey] = useState<StatsWindow>('D30');
  const [product, setProduct] = useState<ProductCode | 'ALL'>('ALL');

  const query = useQuery({
    queryKey: ['statistics', product, windowKey],
    queryFn: () => api<StatisticsDTO>(`/statistics?product=${product}&window=${windowKey}`),
  });

  const data = query.data;

  return (
    <Screen
      title={t('stats.title')}
      back
      refreshControl={
        <RefreshControl
          refreshing={query.isFetching && !query.isPending}
          tintColor={colors.text.secondary}
          onRefresh={() => void query.refetch()}
        />
      }
    >
      <View style={{ paddingTop: spacing[3], gap: spacing[3] }}>
        <Segmented
          options={PRODUCTS.map((code) => ({
            value: code,
            label: code === 'ALL' ? t('common.all') : t(`product.${code}` as MessageKey),
          }))}
          value={product}
          onChange={setProduct}
        />
        <Segmented
          options={WINDOWS.map((key) => ({
            value: key,
            label: t(`stats.window.${key}` as MessageKey),
          }))}
          value={windowKey}
          onChange={setWindowKey}
        />
      </View>

      {query.isPending ? (
        <View style={{ paddingTop: spacing[4] }}>
          <Skeleton height={120} />
          <Skeleton height={180} />
        </View>
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} />
      ) : !data || data.settledTips === 0 ? (
        <Card style={{ marginTop: spacing[4] }}>
          <Text style={styles.empty}>{t('stats.empty')}</Text>
        </Card>
      ) : (
        <>
          <SectionTitle>{t('stats.successRateLastDays', { days: data.days })}</SectionTitle>
          <StatGrid>
            <StatTile label={t('stats.totalTips')} value={String(data.settledTips)} />
            <StatTile
              label={t('stats.winRate')}
              value={formatPercent(data.winRate, locale)}
              tone={data.winRate >= 50 ? 'positive' : 'neutral'}
            />
            <StatTile
              label={t('stats.roi')}
              value={formatPercent(data.roi, locale)}
              tone={data.roi > 0 ? 'positive' : data.roi < 0 ? 'negative' : 'neutral'}
            />
            <StatTile
              label={t('stats.profit')}
              value={formatSignedUnits(data.profit, locale)}
              tone={data.profit > 0 ? 'positive' : data.profit < 0 ? 'negative' : 'neutral'}
              hint={t('stats.disclaimer', { stake: data.avgStake.toFixed(2) })}
            />
            <StatTile label={t('stats.averageOdds')} value={data.avgOdds.toFixed(2)} tone="gold" />
            <StatTile
              label={t('stats.returnOnPurchase')}
              value={formatPercent(data.returnOnStake, locale, 0)}
              tone="gold"
            />
            <StatTile label={t('stats.wins')} value={String(data.won)} tone="positive" />
            <StatTile label={t('stats.losses')} value={String(data.lost)} tone="negative" />
            <StatTile
              label={t('stats.streak')}
              value={`${data.bestStreak} / ${data.worstStreak}`}
            />
            <StatTile label={t('stats.currentStreak')} value={String(data.currentStreak)} />
          </StatGrid>

          <SectionTitle>{t('stats.cumulativeProfit')}</SectionTitle>
          <Card>
            <ProfitSparkline points={data.byDay} />
            <Text style={styles.caption}>
              {data.periodStart.slice(0, 10)} – {data.periodEnd.slice(0, 10)}
            </Text>
          </Card>

          {data.byLeague.length > 0 ? (
            <>
              <SectionTitle>{t('stats.byLeague')}</SectionTitle>
              <Card>
                {data.byLeague.slice(0, 8).map((bucket) => (
                  <BarRow
                    key={bucket.key}
                    label={bucket.label}
                    value={`${formatPercent(bucket.winRate, locale, 0)} · ${bucket.tips}`}
                    percent={bucket.winRate}
                    color={bucket.roi >= 0 ? colors.accent.DEFAULT : colors.status.LOST}
                  />
                ))}
              </Card>
            </>
          ) : null}

          {data.byMarket.length > 0 ? (
            <>
              <SectionTitle>{t('stats.byMarket')}</SectionTitle>
              <Card>
                {data.byMarket.slice(0, 8).map((bucket) => (
                  <BarRow
                    key={bucket.key}
                    label={bucket.label}
                    value={`${formatPercent(bucket.winRate, locale, 0)} · ${bucket.tips}`}
                    percent={bucket.winRate}
                    color={bucket.roi >= 0 ? colors.accent.DEFAULT : colors.status.LOST}
                  />
                ))}
              </Card>
            </>
          ) : null}

          <Text style={styles.disclaimer}>
            {t('stats.disclaimer', { stake: data.avgStake.toFixed(2) })} {t('legal.noGuarantee')}
          </Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.text.secondary, fontSize: fontSize.base, textAlign: 'center' },
  sparkline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
    height: 64,
  },
  sparkBar: { flex: 1, borderRadius: radii.xs, minWidth: 1 },
  caption: { marginTop: spacing[2], color: colors.text.muted, fontSize: fontSize.xs },
  disclaimer: {
    marginTop: spacing[5],
    color: colors.text.muted,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.6,
    textAlign: 'center',
  },
});
