import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme, shared } from '@/lib/theme';

const { colors, fontSize, radii, spacing } = theme;

export type StatTone = 'neutral' | 'positive' | 'negative' | 'gold';

const TONE_COLOR: Record<StatTone, string> = {
  neutral: colors.text.primary,
  positive: colors.status.WON,
  negative: colors.status.LOST,
  gold: colors.gold.DEFAULT,
};

/** Compact KPI tile used across the statistics and account screens. */
export function StatTile({
  label,
  value,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value: string;
  tone?: StatTone;
  hint?: string;
}): ReactNode {
  return (
    <View style={[shared.card, styles.tile]}>
      <Text numberOfLines={1} style={styles.label}>
        {label.toUpperCase()}
      </Text>
      <Text style={[styles.value, { color: TONE_COLOR[tone] }]}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function StatGrid({ children }: { children: ReactNode }): ReactNode {
  return <View style={styles.grid}>{children}</View>;
}

/**
 * Horizontal bar row, used for the league / market breakdowns and poll results.
 * A plain View width percentage keeps it dependency-free.
 */
export function BarRow({
  label,
  value,
  percent,
  color = colors.accent.DEFAULT,
}: {
  label: string;
  value: string;
  percent: number;
  color?: string;
}): ReactNode {
  const width = `${Math.max(2, Math.min(100, percent))}%` as const;
  return (
    <View style={styles.barRow}>
      <View style={styles.barHeader}>
        <Text numberOfLines={1} style={styles.barLabel}>
          {label}
        </Text>
        <Text style={styles.barValue}>{value}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  tile: {
    flexGrow: 1,
    flexBasis: '47%',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
  },
  label: { color: colors.text.muted, fontSize: fontSize.xs, fontWeight: '500', letterSpacing: 0.4 },
  value: {
    marginTop: spacing[1],
    fontSize: fontSize.xl,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  hint: { marginTop: spacing[1], color: colors.text.muted, fontSize: fontSize.xs },
  barRow: { marginBottom: spacing[3] },
  barHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  barLabel: { flex: 1, color: colors.text.primary, fontSize: fontSize.base },
  barValue: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    marginTop: spacing[1.5],
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.bg.cardAlt,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: radii.full },
});
