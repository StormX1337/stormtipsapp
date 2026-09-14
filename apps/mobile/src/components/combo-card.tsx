import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ComboDTO } from '@profit-tips/types';
import { formatDateTime } from '@profit-tips/ui';
import { theme, shared } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import { StatusBadge, TeamCrest } from './primitives';
import { LockIcon } from './icons';

const { colors, fontSize, spacing } = theme;

/** An accumulator with its legs listed underneath, as sold in the Combo product. */
export function ComboCard({ combo }: { combo: ComboDTO }): ReactNode {
  const { t, locale } = useI18n();
  const profit = combo.profit ?? 0;

  return (
    <View style={[shared.card, styles.card]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text numberOfLines={1} style={styles.title}>
            {combo.title}
          </Text>
          {combo.publishAt ? (
            <Text style={styles.published}>{formatDateTime(combo.publishAt, undefined, locale)}</Text>
          ) : null}
        </View>
        <View style={styles.headerOdds}>
          <Text style={styles.oddsLabel}>{t('common.odds').toUpperCase()}</Text>
          <Text style={[styles.oddsValue, combo.isLocked && { color: colors.text.muted }]}>
            {combo.isLocked ? '•••' : (combo.totalOdds?.toFixed(2) ?? '—')}
          </Text>
        </View>
        <StatusBadge outcome={combo.outcome} />
      </View>

      {combo.items.map((item, index) => (
        <View key={item.id} style={[styles.leg, index > 0 && styles.legBorder]}>
          <TeamCrest
            name={item.event.homeTeam.name}
            color={item.event.homeTeam.colorPrimary}
            size={18}
          />
          <TeamCrest
            name={item.event.awayTeam.name}
            color={item.event.awayTeam.colorPrimary}
            size={18}
          />
          <View style={styles.legBody}>
            <Text numberOfLines={1} style={styles.legTeams}>
              {item.event.homeTeam.shortName ?? item.event.homeTeam.name} –{' '}
              {item.event.awayTeam.shortName ?? item.event.awayTeam.name}
            </Text>
            <View style={styles.legSelectionRow}>
              {item.isLocked ? <LockIcon size={11} color={colors.text.muted} /> : null}
              <Text
                numberOfLines={1}
                style={[styles.legSelection, item.isLocked && { color: colors.text.muted }]}
              >
                {item.isLocked ? t('feed.lockedTitle') : (item.selectionLabel ?? '')}
              </Text>
            </View>
          </View>
          <Text style={styles.legOdds}>{item.isLocked ? '•••' : item.odds?.toFixed(2)}</Text>
          <StatusBadge outcome={item.outcome} />
        </View>
      ))}

      {!combo.isLocked && combo.potentialReturn !== null ? (
        <View style={styles.footer}>
          <Text style={styles.footerLabel}>
            {t('tip.stake')}: <Text style={styles.footerValue}>{combo.stake.toFixed(2)}</Text>
          </Text>
          <Text style={styles.footerLabel}>
            {t('tip.profit')}:{' '}
            <Text
              style={[
                styles.footerValue,
                {
                  color:
                    combo.profit === null
                      ? colors.text.primary
                      : profit > 0
                        ? colors.status.WON
                        : profit < 0
                          ? colors.status.LOST
                          : colors.text.primary,
                },
              ]}
            >
              {combo.profit === null
                ? `→ ${combo.potentialReturn.toFixed(2)}`
                : `${profit > 0 ? '+' : ''}${profit.toFixed(2)}`}
            </Text>
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing[3], overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: colors.text.primary, fontSize: fontSize.md, fontWeight: '700' },
  published: { marginTop: 2, color: colors.text.muted, fontSize: fontSize.xs },
  headerOdds: { alignItems: 'flex-end' },
  oddsLabel: { color: colors.text.muted, fontSize: fontSize['2xs'], fontWeight: '600', letterSpacing: 0.5 },
  oddsValue: {
    color: colors.gold.DEFAULT,
    fontSize: fontSize.xl,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  leg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
  },
  legBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.subtle },
  legBody: { flex: 1, minWidth: 0 },
  legTeams: { color: colors.text.primary, fontSize: fontSize.sm },
  legSelectionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  legSelection: {
    flex: 1,
    color: colors.accent.DEFAULT,
    fontSize: fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  legOdds: {
    color: colors.text.secondary,
    fontSize: fontSize.base,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg.cardAlt,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  footerLabel: { color: colors.text.secondary, fontSize: fontSize.sm },
  footerValue: { color: colors.text.primary, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
