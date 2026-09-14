import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { MessageKey } from '@profit-tips/ui';
import type { ProductCode, TipDTO } from '@profit-tips/types';
import { formatDateTime } from '@profit-tips/ui';
import { theme, shared } from '@/lib/theme';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Card, Screen } from '@/components/layout';
import {
  Button,
  ErrorState,
  OddsText,
  Skeleton,
  StatusBadge,
  TeamCrest,
} from '@/components/primitives';
import { LockIcon } from '@/components/icons';

const { colors, fontSize, radii, spacing } = theme;

const CTA_KEY: Record<ProductCode, MessageKey> = {
  FREE: 'paywall.getVip',
  VIP: 'paywall.getVip',
  EXTRA: 'paywall.getExtra',
  COMBO: 'paywall.getCombo',
  FIX_ODDS: 'paywall.getFixOdds',
};

function Row({ label, value, tone }: { label: string; value: string; tone?: string }): ReactNode {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

/** Confidence bar — the model's own certainty, never a promise of an outcome. */
function ConfidenceMeter({ value }: { value: number | null }): ReactNode {
  const { t } = useI18n();
  if (value === null) return null;
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.confidenceHeader}>
        <Text style={styles.rowLabel}>{t('tip.confidence')}</Text>
        <Text style={styles.rowValue}>{value}%</Text>
      </View>
      <View style={styles.confidenceTrack}>
        <View style={[styles.confidenceFill, { width: `${Math.min(100, Math.max(0, value))}%` }]} />
      </View>
    </View>
  );
}

export default function TipDetailScreen(): ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const router = useRouter();

  const query = useQuery({
    queryKey: ['tip', id],
    queryFn: () => api<TipDTO>(`/tips/${id}`),
    enabled: Boolean(id),
  });

  const tip = query.data;

  return (
    <Screen title={tip ? tip.league.name : t('common.loading')} back>
      <View style={{ paddingTop: spacing[4], gap: spacing[3] }}>
        {query.isPending ? (
          <>
            <Skeleton height={120} />
            <Skeleton height={180} />
          </>
        ) : query.isError ? (
          <ErrorState
            message={(query.error as Error).message}
            onRetry={() => void query.refetch()}
          />
        ) : tip ? (
          <>
            <Card>
              <View style={styles.leagueRow}>
                <Text style={styles.flag}>{tip.country?.flagEmoji ?? '🏳️'}</Text>
                <Text numberOfLines={1} style={styles.leagueName}>
                  {tip.country?.name ? `${tip.country.name} : ` : ''}
                  {tip.league.name}
                </Text>
                <StatusBadge outcome={tip.outcome} />
              </View>

              {[
                { team: tip.event.homeTeam, score: tip.event.homeScore },
                { team: tip.event.awayTeam, score: tip.event.awayScore },
              ].map(({ team, score }) => (
                <View key={team.id} style={styles.teamRow}>
                  <TeamCrest name={team.name} color={team.colorPrimary} size={26} />
                  <Text numberOfLines={1} style={styles.teamName}>
                    {team.name}
                  </Text>
                  {score !== null ? <Text style={styles.score}>{score}</Text> : null}
                </View>
              ))}

              <Text style={styles.kickoff}>
                {t('feed.kickoff')}: {formatDateTime(tip.event.startsAt, undefined, locale)}
                {tip.event.venue ? ` · ${tip.event.venue}` : ''}
              </Text>
            </Card>

            {tip.isLocked ? (
              <Card style={styles.locked}>
                <LockIcon size={26} color={colors.gold[300]} />
                <Text style={styles.lockedTitle}>{t('feed.lockedTitle')}</Text>
                <Text style={styles.lockedBody}>
                  {t('feed.lockedBody', { product: t(`product.${tip.product}` as MessageKey) })}
                </Text>
                <Button
                  label={t(CTA_KEY[tip.product])}
                  variant="gold"
                  onPress={() =>
                    router.push(`/paywall/${tip.product.toLowerCase().replace('_', '-')}`)
                  }
                  style={{ alignSelf: 'stretch' }}
                />
              </Card>
            ) : (
              <>
                <Card>
                  <Text style={styles.sectionLabel}>{t('tip.selection').toUpperCase()}</Text>
                  <Text style={styles.selection}>{tip.selectionLabel}</Text>

                  <View style={styles.oddsRow}>
                    <OddsText odds={tip.odds} size="lg" />
                    <ConfidenceMeter value={tip.confidence} />
                  </View>

                  <View style={styles.rows}>
                    <Row label={t('tip.market')} value={tip.marketName} />
                    {tip.bookmaker ? (
                      <Row
                        label={t('tip.bookmaker')}
                        value={tip.bookmaker.name}
                        tone={tip.bookmaker.color ?? undefined}
                      />
                    ) : null}
                    <Row
                      label={t('tip.originalOdds')}
                      value={tip.originalOdds?.toFixed(2) ?? '—'}
                    />
                    <Row
                      label={t('tip.currentOdds')}
                      value={`${tip.currentOdds?.toFixed(2) ?? '—'}${
                        tip.oddsChanged ? ` · ${t('tip.oddsChanged')}` : ''
                      }`}
                      tone={tip.oddsChanged ? colors.gold.DEFAULT : undefined}
                    />
                    <Row label={t('tip.stake')} value={tip.stake.toFixed(2)} />
                    {tip.publishAt ? (
                      <Row
                        label={t('tip.publishedAt')}
                        value={formatDateTime(tip.publishAt, undefined, locale)}
                      />
                    ) : null}
                  </View>
                </Card>

                {tip.result ? (
                  <Card>
                    <Text style={styles.sectionLabel}>
                      {t('subscription.status').toUpperCase()}
                    </Text>
                    <View style={styles.rows}>
                      <Row
                        label={t('stats.profit')}
                        value={`${tip.result.profit > 0 ? '+' : ''}${tip.result.profit.toFixed(2)}`}
                        tone={
                          tip.result.profit > 0
                            ? colors.status.WON
                            : tip.result.profit < 0
                              ? colors.status.LOST
                              : undefined
                        }
                      />
                      <Row
                        label={t('tip.market')}
                        value={`${tip.result.homeScore ?? '—'} : ${tip.result.awayScore ?? '—'}`}
                      />
                      <Row
                        label={t('tip.publishedAt')}
                        value={formatDateTime(tip.result.settledAt, undefined, locale)}
                      />
                    </View>
                    {tip.result.note ? <Text style={styles.note}>{tip.result.note}</Text> : null}
                  </Card>
                ) : null}

                <Card>
                  <Text style={styles.sectionLabel}>{t('tip.analysis').toUpperCase()}</Text>
                  <Text style={styles.analysis}>{tip.analysis ?? t('tip.noAnalysis')}</Text>
                </Card>
              </>
            )}

            <Text style={styles.legal}>
              {t('legal.ageNotice')} {t('legal.noGuarantee')}
            </Text>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  leagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingBottom: spacing[3],
  },
  flag: { fontSize: fontSize.lg },
  leagueName: { flex: 1, color: colors.text.secondary, fontSize: fontSize.sm },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[1],
  },
  teamName: { flex: 1, color: colors.text.primary, fontSize: fontSize.lg, fontWeight: '600' },
  score: { color: colors.text.primary, fontSize: fontSize.lg, fontWeight: '700' },
  kickoff: { marginTop: spacing[3], color: colors.text.muted, fontSize: fontSize.sm },
  locked: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[6] },
  lockedTitle: { color: colors.text.primary, fontSize: fontSize.lg, fontWeight: '700' },
  lockedBody: { color: colors.text.secondary, fontSize: fontSize.base, textAlign: 'center' },
  sectionLabel: { color: colors.text.muted, fontSize: fontSize.xs, letterSpacing: 0.6 },
  selection: {
    marginTop: spacing[1],
    color: colors.accent.DEFAULT,
    fontSize: fontSize.lg,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  oddsRow: { marginTop: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  rows: {
    marginTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.subtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[4],
    paddingVertical: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  rowLabel: { color: colors.text.muted, fontSize: fontSize.sm },
  rowValue: { color: colors.text.primary, fontSize: fontSize.sm, fontWeight: '600' },
  confidenceHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  confidenceTrack: {
    marginTop: spacing[1.5],
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.bg.cardAlt,
    overflow: 'hidden',
  },
  confidenceFill: { height: '100%', backgroundColor: colors.accent.DEFAULT },
  analysis: {
    marginTop: spacing[2],
    color: colors.text.secondary,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.6,
  },
  note: { marginTop: spacing[2], color: colors.text.muted, fontSize: fontSize.sm },
  legal: {
    ...shared.muted,
    textAlign: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
    borderRadius: radii.sm,
    lineHeight: fontSize.sm * 1.5,
  },
});
