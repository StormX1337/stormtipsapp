import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import type { PromoBadge as PromoBadgeCode, PromotionDTO } from '@profit-tips/types';
import type { MessageKey } from '@profit-tips/ui';
import { theme } from '@/lib/theme';
import { useT } from '@/lib/i18n';

const { colors, fontSize, radii, spacing } = theme;

const BADGE_LABEL: Record<Exclude<PromoBadgeCode, 'NONE'>, MessageKey> = {
  MOST_POPULAR: 'paywall.mostPopular',
  BEST_VALUE: 'paywall.bestValue',
  LIMITED: 'paywall.limited',
  SALE: 'paywall.sale',
  NEW: 'paywall.new',
};

export function PromoBadge({ badge }: { badge: PromoBadgeCode }): ReactNode {
  const t = useT();
  if (badge === 'NONE') return null;
  const color = badge === 'SALE' || badge === 'LIMITED' ? colors.pink.DEFAULT : colors.pink[500];
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.badgeText}>{t(BADGE_LABEL[badge]).toUpperCase()}</Text>
    </View>
  );
}

function targetRoute(promotion: PromotionDTO): string {
  if (promotion.deepLink?.startsWith('profittips://')) {
    const path = promotion.deepLink.replace('profittips://', '');
    return `/${path === 'paywall/bundle' ? 'paywall/combo' : path}`;
  }
  if (promotion.product) {
    return `/paywall/${promotion.product.toLowerCase().replace('_', '-')}`;
  }
  return '/combo';
}

/**
 * Promotional banner.
 *
 * Gradient-free but visually equivalent to the web banner: the admin-supplied
 * colours drive the surface, the ball is drawn with SVG so no artwork ships.
 */
export function PromoBanner({ promotion }: { promotion: PromotionDTO }): ReactNode {
  const router = useRouter();
  const background = promotion.gradientTo ?? promotion.gradientFrom ?? colors.bg.raised;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={promotion.title}
      onPress={() => router.push(targetRoute(promotion) as never)}
      style={({ pressed }) => [
        styles.banner,
        { backgroundColor: background },
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={styles.neonFrame} pointerEvents="none" />

      {promotion.badge !== 'NONE' ? (
        <View style={styles.bannerBadge}>
          <PromoBadge badge={promotion.badge} />
        </View>
      ) : null}

      <View style={styles.ball} pointerEvents="none">
        {/* Drawn, not imported — the app bundles no third-party artwork. */}
        <Svg width={72} height={72} viewBox="0 0 24 24">
          <Circle
            cx="12"
            cy="12"
            r="10"
            fill={colors.bg.subtle}
            stroke={colors.accent.DEFAULT}
            strokeWidth={1.4}
          />
          <Path d="M12 6.5 15.5 9l-1.3 4h-4.4L8.5 9z" fill={colors.accent.DEFAULT} opacity={0.9} />
          <Path
            d="M12 2.6v3.9M3.6 8.6 8.5 9M20.4 8.6 15.5 9M6.6 20.2l3.2-7.2M17.4 20.2l-3.2-7.2"
            stroke={colors.accent.DEFAULT}
            strokeWidth={1.2}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </View>

      <View style={styles.bannerBody}>
        <Text style={styles.bannerTitle}>{promotion.title}</Text>
        {promotion.subtitle ? (
          <Text numberOfLines={3} style={styles.bannerSubtitle}>
            {promotion.subtitle}
          </Text>
        ) : null}
        {promotion.ctaLabel ? (
          <View style={styles.cta}>
            <Text style={styles.ctaText}>{promotion.ctaLabel}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginTop: spacing[3],
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  neonFrame: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: `${colors.accent.DEFAULT}59`,
  },
  bannerBadge: { position: 'absolute', top: spacing[2], left: spacing[3], zIndex: 2 },
  ball: { position: 'absolute', right: -8, bottom: -8 },
  bannerBody: { paddingVertical: spacing[4], paddingLeft: spacing[4], paddingRight: 84 },
  bannerTitle: { color: colors.accent[300], fontSize: fontSize.md, fontWeight: '800' },
  bannerSubtitle: {
    marginTop: spacing[1],
    color: 'rgba(255,255,255,0.85)',
    fontSize: fontSize['2xs'],
    lineHeight: 14,
  },
  cta: {
    marginTop: spacing[2.5],
    alignSelf: 'flex-start',
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: radii.xs,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
  },
  ctaText: { color: colors.text.inverse, fontSize: fontSize['2xs'], fontWeight: '700' },
  badge: {
    borderRadius: radii.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
  },
  badgeText: {
    color: colors.text.primary,
    fontSize: fontSize['2xs'],
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
