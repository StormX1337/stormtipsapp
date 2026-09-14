import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import type { ProductCode, TipOutcome } from '@profit-tips/types';
import type { MessageKey } from '@profit-tips/ui';
import { theme, shared } from '@/lib/theme';
import { useT } from '@/lib/i18n';

const { colors, fontSize, radii, spacing } = theme;

/** Coloured monogram — no third-party crests are bundled with the app. */
export function TeamCrest({
  name,
  color,
  size = 20,
}: {
  name: string;
  color?: string | null;
  size?: number;
}): ReactNode {
  const initials = name
    .replace(/^(FC|SC|SV|AC|AS|SS|VfB|RB|1\.)\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <View
      style={[
        styles.crest,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color ?? colors.bg.cardAlt,
        },
      ]}
    >
      <Text style={{ fontSize: size * 0.42, fontWeight: '700', color: contrastOn(color) }}>
        {initials || '?'}
      </Text>
    </View>
  );
}

function contrastOn(hex?: string | null): string {
  if (!hex) return colors.text.secondary;
  const value = hex.replace('#', '');
  if (value.length < 6) return colors.text.primary;
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
  const channel = (c: number): number => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channel(r ?? 0) + 0.7152 * channel(g ?? 0) + 0.0722 * channel(b ?? 0);
  return luminance > 0.45 ? colors.text.inverse : colors.text.primary;
}

const OUTCOME_GLYPH: Record<TipOutcome, string> = {
  PENDING: '–',
  LIVE: '●',
  WON: '✓',
  LOST: '✕',
  VOID: '=',
  HALF_WON: '½✓',
  HALF_LOST: '½✕',
};

export function StatusBadge({ outcome }: { outcome: TipOutcome }): ReactNode {
  const t = useT();
  const color = colors.status[outcome];
  return (
    <View
      accessibilityLabel={t(`status.${outcome}` as MessageKey)}
      style={[styles.statusBadge, { backgroundColor: `${color}26` }]}
    >
      <Text style={{ color, fontSize: fontSize.xs, fontWeight: '700' }}>
        {OUTCOME_GLYPH[outcome]}
      </Text>
    </View>
  );
}

export function ProductBadge({ product }: { product: ProductCode }): ReactNode {
  const t = useT();
  if (product === 'FREE') return null;
  const color = colors.product[product];
  return (
    <View style={[styles.productBadge, { borderColor: color }]}>
      <Text style={{ color, fontSize: fontSize['2xs'], fontWeight: '700', letterSpacing: 0.6 }}>
        {t(`product.${product}` as MessageKey).toUpperCase()}
      </Text>
    </View>
  );
}

export function OddsText({
  odds,
  locked,
  size = 'md',
}: {
  odds: number | null;
  locked?: boolean;
  size?: 'sm' | 'md' | 'lg';
}): ReactNode {
  const value = locked || odds === null ? '•••' : odds.toFixed(2);
  const fontSizes = { sm: fontSize.base, md: fontSize.lg, lg: fontSize['3xl'] } as const;
  return (
    <Text
      style={{
        color: locked ? colors.text.muted : colors.accent.DEFAULT,
        fontSize: fontSizes[size],
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
      }}
    >
      {value}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'gold' | 'outline' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}): ReactNode {
  const background =
    variant === 'primary'
      ? colors.accent.DEFAULT
      : variant === 'gold'
        ? colors.gold.DEFAULT
        : variant === 'danger'
          ? `${colors.status.LOST}26`
          : 'transparent';

  const textColor =
    variant === 'primary' || variant === 'gold'
      ? colors.text.inverse
      : variant === 'danger'
        ? colors.status.LOST
        : colors.text.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: background,
          borderColor: variant === 'outline' ? colors.border.strong : 'transparent',
          borderWidth: variant === 'outline' ? StyleSheet.hairlineWidth : 0,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <Text style={{ color: textColor, fontWeight: '700', fontSize: fontSize.md }}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Skeleton({
  height,
  width,
}: {
  height: number;
  width?: number | string;
}): ReactNode {
  return (
    <View style={[styles.skeleton, { height, width: (width as number | undefined) ?? '100%' }]} />
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }): ReactNode {
  return (
    <View style={styles.empty}>
      <Text style={[shared.sectionTitle, { textAlign: 'center' }]}>{title}</Text>
      {body ? (
        <Text style={[shared.muted, { textAlign: 'center', marginTop: spacing[2] }]}>{body}</Text>
      ) : null}
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}): ReactNode {
  const t = useT();
  return (
    <View style={styles.empty}>
      <Text style={[shared.sectionTitle, { textAlign: 'center' }]}>{t('feed.errorTitle')}</Text>
      <Text style={[shared.muted, { textAlign: 'center', marginTop: spacing[2] }]}>{message}</Text>
      {onRetry ? (
        <Button
          label={t('common.retry')}
          variant="outline"
          onPress={onRetry}
          style={{ marginTop: spacing[4], alignSelf: 'center', paddingHorizontal: spacing[5] }}
        />
      ) : null}
    </View>
  );
}

export function ResponsibleGamblingNote(): ReactNode {
  const t = useT();
  return (
    <Text style={styles.legal}>
      {t('legal.ageNotice')} {t('legal.noGuarantee')}
    </Text>
  );
}

const styles = StyleSheet.create({
  crest: { alignItems: 'center', justifyContent: 'center' },
  statusBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: radii.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.xs,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  button: {
    minHeight: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
  },
  skeleton: {
    backgroundColor: colors.bg.card,
    borderRadius: radii.sm,
    marginBottom: spacing[2],
  },
  empty: {
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[6],
    alignItems: 'center',
  },
  legal: {
    marginTop: spacing[6],
    marginBottom: spacing[4],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
    borderRadius: radii.sm,
    color: colors.text.muted,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.6,
    textAlign: 'center',
  },
});
