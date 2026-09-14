import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import type { TipDTO, TipFeedGroupDTO } from '@storm-tips/types';
import { formatKickoff } from '@storm-tips/ui';
import { theme, shared } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import { OddsText, ProductBadge, StatusBadge, TeamCrest } from './primitives';

const { colors, fontSize, radii, spacing } = theme;

/** Country flag + "Country : League" + bookmaker wordmark, as in the design. */
export function LeagueHeader({ group }: { group: TipFeedGroupDTO }): ReactNode {
  const { league, bookmaker } = group;
  return (
    <View style={styles.leagueHeader}>
      <Text style={styles.flag}>{league.country?.flagEmoji ?? '🏳️'}</Text>
      <Text numberOfLines={1} style={styles.leagueName}>
        {league.country?.name ? `${league.country.name} : ` : ''}
        {league.name}
      </Text>
      {bookmaker ? (
        <Text style={[styles.bookmaker, { color: bookmaker.color ?? colors.text.muted }]}>
          {bookmaker.name}
        </Text>
      ) : null}
    </View>
  );
}

function TeamRow({
  name,
  color,
  score,
}: {
  name: string;
  color?: string | null;
  score?: number | null;
}): ReactNode {
  return (
    <View style={styles.teamRow}>
      <TeamCrest name={name} color={color} />
      <Text numberOfLines={1} style={styles.teamName}>
        {name}
      </Text>
      {score !== null && score !== undefined ? <Text style={styles.score}>{score}</Text> : null}
    </View>
  );
}

export function TipCard({ tip }: { tip: TipDTO }): ReactNode {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { event } = tip;

  const settled = tip.settledAt !== null;
  const isLive = !settled && (event.status === 'LIVE' || event.status === 'HALFTIME');
  const showScore = isLive || event.status === 'FINISHED' || settled;
  const startsAt = new Date(event.startsAt);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/tips/${tip.id}`)}
      style={({ pressed }) => [shared.card, styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.timeRail}>
        <Text style={styles.railDate}>
          {new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-GB', { month: 'short' }).format(
            startsAt,
          )}
        </Text>
        <Text style={styles.railDate}>{startsAt.getDate()}</Text>
        <Text style={[styles.railTime, isLive && { color: colors.status.LIVE }]}>
          {isLive
            ? event.minute
              ? `${event.minute}'`
              : t('feed.liveNow')
            : formatKickoff(event.startsAt, undefined, locale)}
        </Text>
      </View>

      <View style={styles.body}>
        <TeamRow
          name={event.homeTeam.shortName ?? event.homeTeam.name}
          color={event.homeTeam.colorPrimary}
          score={showScore ? event.homeScore : null}
        />
        <TeamRow
          name={event.awayTeam.shortName ?? event.awayTeam.name}
          color={event.awayTeam.colorPrimary}
          score={showScore ? event.awayScore : null}
        />

        <View style={styles.selectionRow}>
          <OddsText odds={tip.odds} locked={tip.isLocked} />
          <Text
            numberOfLines={2}
            style={[styles.selection, tip.isLocked && { color: colors.text.muted }]}
          >
            {tip.isLocked ? t('feed.lockedTitle').toUpperCase() : tip.selectionLabel}
          </Text>
        </View>
      </View>

      <View style={styles.trailing}>
        <StatusBadge outcome={tip.outcome} />
        <ProductBadge product={tip.product} />
      </View>
    </Pressable>
  );
}

export function TipCardSkeleton(): ReactNode {
  return (
    <View style={[shared.card, styles.card]}>
      <View style={styles.timeRail}>
        <View style={[styles.shimmer, { width: 24, height: 8 }]} />
        <View style={[styles.shimmer, { width: 16, height: 8 }]} />
        <View style={[styles.shimmer, { width: 28, height: 10, marginTop: spacing[2] }]} />
      </View>
      <View style={styles.body}>
        <View style={[styles.shimmer, { width: '70%', height: 14 }]} />
        <View style={[styles.shimmer, { width: '55%', height: 14 }]} />
        <View style={[styles.shimmer, { width: '80%', height: 14, marginTop: spacing[2] }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  leagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
    paddingHorizontal: spacing[1],
  },
  flag: { fontSize: fontSize.lg },
  leagueName: {
    flex: 1,
    color: colors.text.primary,
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  bookmaker: { fontSize: fontSize.sm, fontWeight: '800', fontStyle: 'italic' },
  card: {
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  timeRail: { width: 36 },
  railDate: {
    color: colors.text.muted,
    fontSize: fontSize['2xs'],
    fontWeight: '500',
    lineHeight: 12,
  },
  railTime: {
    marginTop: spacing[2],
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  body: { flex: 1, minWidth: 0 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 3 },
  teamName: { flex: 1, color: colors.text.primary, fontSize: fontSize.base },
  score: { color: colors.text.primary, fontSize: fontSize.base, fontWeight: '700' },
  selectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[2.5],
    marginTop: spacing[1.5],
  },
  selection: {
    flex: 1,
    color: colors.accent.DEFAULT,
    fontSize: fontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  trailing: { alignItems: 'flex-end', gap: spacing[1.5] },
  shimmer: {
    backgroundColor: colors.bg.cardAlt,
    borderRadius: radii.xs,
    marginBottom: spacing[1.5],
  },
});
