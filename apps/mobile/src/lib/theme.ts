import { StyleSheet } from 'react-native';
import { colors, fontSize, radii, sizes, spacing } from '@storm-tips/ui';

/**
 * Native theme.
 *
 * Re-exports the shared design tokens so the app and the web front-end stay in
 * visual lockstep — there is no second source of colours or spacing.
 */
export const theme = { colors, spacing, radii, fontSize, sizes } as const;

export const shared = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  gutter: {
    paddingHorizontal: sizes.pageGutter,
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.subtle,
  },
  title: {
    color: colors.text.primary,
    fontSize: fontSize.xl,
    fontWeight: '800',
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  body: {
    color: colors.text.secondary,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.5,
  },
  muted: {
    color: colors.text.muted,
    fontSize: fontSize.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
});

/** Outcome → colour, shared by the status chip and the statistics charts. */
export const outcomeColor: Record<string, string> = colors.status;

export const productColor: Record<string, string> = colors.product;
