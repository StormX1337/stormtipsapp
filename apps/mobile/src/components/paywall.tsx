import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import type { ProductCode, PromotionDTO, SubscriptionPlanDTO } from '@profit-tips/types';
import type { MessageKey } from '@profit-tips/ui';
import { theme, shared } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import {
  PurchasesUnavailableError,
  listenForPurchases,
  purchaseSubscription,
  restorePurchases,
} from '@/lib/purchases';
import { Button } from './primitives';
import { PromoBadge, PromoBanner } from './promo-banner';
import { CheckIcon, CrownIcon, PRODUCT_ICON } from './icons';

const { colors, fontSize, radii, sizes, spacing } = theme;

export interface PaywallStatistics {
  days: number;
  successfulAnalyses: number;
  returnOnStake: number;
  averageOdds: number;
  winRate: number;
  totalTips: number;
  profit: number;
  stake: number;
}

export interface PaywallData {
  product: { code: ProductCode; name: string; tagline: string | null; benefits: string[] };
  unlocked: boolean;
  plans: SubscriptionPlanDTO[];
  promotions: PromotionDTO[];
  statistics: PaywallStatistics;
  legal: { minimumAge: number; disclaimer: string };
}

/** Gold statistic circle; its diameter encodes the metric's importance. */
export function StatCircle({
  value,
  size = 'md',
}: {
  value: string;
  size?: 'sm' | 'md' | 'lg';
}): ReactNode {
  const dimension = sizes.statCircle[size];
  const textSize =
    value.length > 6 ? dimension * 0.2 : value.length > 4 ? dimension * 0.24 : dimension * 0.3;
  return (
    <View
      style={[styles.circle, { width: dimension, height: dimension, borderRadius: dimension / 2 }]}
    >
      <Text style={[styles.circleText, { fontSize: textSize }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function StatCirclePanel({ statistics }: { statistics: PaywallStatistics }): ReactNode {
  const { t, locale } = useI18n();
  const numberFormat = new Intl.NumberFormat(locale === 'de' ? 'de-DE' : 'en-GB');

  const rows: { label: string; value: string; size: 'sm' | 'md' | 'lg' }[] = [
    {
      label: t('stats.successfulAnalyses'),
      value: numberFormat.format(statistics.successfulAnalyses),
      size: 'md',
    },
    {
      label: t('stats.returnOnPurchase'),
      value: `${numberFormat.format(Math.round(statistics.returnOnStake))}%`,
      size: 'lg',
    },
    { label: t('stats.averageOdds'), value: statistics.averageOdds.toFixed(2), size: 'sm' },
  ];

  return (
    <View style={[shared.card, styles.panel]}>
      <Text style={styles.panelTitle}>
        {t('stats.successRateLastDays', { days: statistics.days })}
      </Text>
      {rows.map((row) => (
        <View key={row.label} style={styles.panelRow}>
          <Text style={styles.panelLabel}>{row.label}</Text>
          <StatCircle value={row.value} size={row.size} />
        </View>
      ))}
      <Text style={styles.panelNote}>{t('stats.disclaimer', { stake: statistics.stake })}</Text>
    </View>
  );
}

function monthLabel(months: number, locale: string): string {
  if (locale === 'de') return months === 1 ? 'Monat' : 'Monate';
  return months === 1 ? 'month' : 'months';
}

/** One of the duration cards (1 / 3 / 6 months). */
export function PlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: SubscriptionPlanDTO;
  selected: boolean;
  onSelect: () => void;
}): ReactNode {
  const { t, locale } = useI18n();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.planCard,
        selected ? styles.planCardSelected : styles.planCardIdle,
        pressed && { opacity: 0.9 },
      ]}
    >
      <Text style={styles.planMonths}>
        {plan.months} {monthLabel(plan.months, locale)}
      </Text>
      <Text style={styles.planPrice}>{plan.price.formatted}</Text>
      {plan.pricePerMonth ? (
        <View style={styles.planRibbon}>
          <Text style={styles.planRibbonText} numberOfLines={1}>
            {t('paywall.perMonth', { price: plan.pricePerMonth.formatted })}
          </Text>
        </View>
      ) : (
        <View style={styles.planRibbonSpacer} />
      )}
      {plan.trialDays > 0 ? (
        <Text style={styles.planTrial}>{t('paywall.trial', { days: plan.trialDays })}</Text>
      ) : null}
    </Pressable>
  );
}

/** Full-width gold bundle card with its "Most Popular" flag. */
export function BundleCard({
  plan,
  selected,
  onSelect,
}: {
  plan: SubscriptionPlanDTO;
  selected: boolean;
  onSelect: () => void;
}): ReactNode {
  const { t, locale } = useI18n();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.bundle,
        selected && styles.bundleSelected,
        pressed && { opacity: 0.95 },
      ]}
    >
      {plan.badge !== 'NONE' ? (
        <View style={styles.bundleBadge}>
          <PromoBadge badge={plan.badge} />
        </View>
      ) : null}

      <View style={styles.bundleRow}>
        <View style={styles.bundleLeft}>
          {plan.savings ? (
            <Text style={styles.bundleSave}>
              {t('paywall.save', { amount: plan.savings.formatted })}
            </Text>
          ) : null}
          <View style={styles.bundleIcons}>
            {plan.products.map((product) => {
              const Icon = PRODUCT_ICON[product] ?? PRODUCT_ICON.FREE!;
              return <Icon key={product} size={18} color={colors.text.onGold} />;
            })}
          </View>
          <Text style={styles.bundleName}>{plan.name}</Text>
        </View>
        <View style={styles.bundleRight}>
          <Text style={styles.bundleMonths}>
            {plan.months} {monthLabel(plan.months, locale)}
          </Text>
          <Text style={styles.bundlePrice}>{plan.price.formatted}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function PaywallHero({
  product,
  title,
}: {
  product: ProductCode;
  title: string;
}): ReactNode {
  const Icon = PRODUCT_ICON[product] ?? PRODUCT_ICON.FREE!;
  return (
    <View style={styles.hero}>
      <View style={styles.heroIcons}>
        <Icon size={20} color={colors.gold.DEFAULT} />
        <Text style={styles.heroPlus}>+</Text>
        <CrownIcon size={20} color={colors.gold.DEFAULT} />
      </View>
      <Text style={styles.heroTitle}>{title}</Text>
    </View>
  );
}

export function BenefitList({ benefits }: { benefits: string[] }): ReactNode {
  const { t } = useI18n();
  if (benefits.length === 0) return null;
  return (
    <View style={[shared.card, styles.panel]}>
      <Text style={styles.benefitsTitle}>{t('paywall.benefits')}</Text>
      {benefits.map((benefit) => (
        <View key={benefit} style={styles.benefitRow}>
          <CheckIcon size={15} color={colors.accent.DEFAULT} />
          <Text style={styles.benefitText}>{benefit}</Text>
        </View>
      ))}
    </View>
  );
}

const TITLE_KEY: Record<ProductCode, MessageKey> = {
  FREE: 'paywall.vipTitle',
  COMBO: 'paywall.comboTitle',
  VIP: 'paywall.vipTitle',
  EXTRA: 'paywall.extraTitle',
  FIX_ODDS: 'paywall.fixOddsTitle',
};

const CTA_KEY: Record<ProductCode, MessageKey> = {
  FREE: 'paywall.getVip',
  COMBO: 'paywall.getCombo',
  VIP: 'paywall.getVip',
  EXTRA: 'paywall.getExtra',
  FIX_ODDS: 'paywall.getFixOdds',
};

/**
 * Full paywall.
 *
 * Purchases run through the platform store when the plan carries a store
 * product id and the native module is present; otherwise the user is sent to
 * the hosted web checkout. Access itself is always granted by the server after
 * it verified the receipt — never by this screen.
 */
export function Paywall({
  data,
  onPurchased,
}: {
  data: PaywallData;
  onPurchased?: () => void;
}): ReactNode {
  const { t } = useI18n();
  const router = useRouter();
  const { user, refresh } = useAuth();

  const [selectedId, setSelectedId] = useState<string>(
    () => data.plans.find((plan) => plan.isPopular)?.id ?? data.plans[0]?.id ?? '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bundlePlans = useMemo(
    () => data.plans.filter((plan) => plan.products.length > 1),
    [data.plans],
  );
  const singlePlans = useMemo(
    () => data.plans.filter((plan) => plan.products.length === 1).slice(0, 3),
    [data.plans],
  );
  const selected = data.plans.find((plan) => plan.id === selectedId) ?? null;

  // Store-side purchase updates (including renewals) are verified server-side.
  useEffect(() => {
    let dispose: (() => void) | undefined;
    void listenForPurchases(
      () => {
        void refresh();
        onPurchased?.();
      },
      (caught) => setError(caught.message),
    ).then((cleanup) => {
      dispose = cleanup;
    });
    return () => dispose?.();
  }, [refresh, onPurchased]);

  function storeProductId(plan: SubscriptionPlanDTO): string | null {
    return Platform.OS === 'ios' ? plan.appleProductId : plan.googleProductId;
  }

  async function checkout(): Promise<void> {
    setError(null);
    if (!user) {
      router.push('/auth/login?next=/combo' as never);
      return;
    }
    if (!selected) return;

    setBusy(true);
    try {
      const storeId = storeProductId(selected);
      if (storeId) {
        await purchaseSubscription(storeId);
        // The purchase listener finishes the flow once the store responds.
        return;
      }
      const response = await api<{ checkoutUrl: string }>('/billing/checkout', {
        method: 'POST',
        body: { planId: selected.id },
      });
      await WebBrowser.openBrowserAsync(response.checkoutUrl);
      await refresh();
    } catch (caught) {
      if (caught instanceof PurchasesUnavailableError) {
        setError(caught.message);
      } else {
        setError((caught as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function restore(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      const count = await restorePurchases();
      await refresh();
      Alert.alert(
        t('paywall.restore'),
        count > 0 ? t('paywall.restoreSuccess') : t('paywall.restoreEmpty'),
      );
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <PaywallHero product={data.product.code} title={t(TITLE_KEY[data.product.code])} />

      {data.promotions[0] ? <PromoBanner promotion={data.promotions[0]} /> : null}

      <StatCirclePanel statistics={data.statistics} />

      {singlePlans.length > 0 ? (
        <View style={styles.planRow}>
          {singlePlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              selected={plan.id === selectedId}
              onSelect={() => setSelectedId(plan.id)}
            />
          ))}
        </View>
      ) : null}

      {bundlePlans.length > 0 && singlePlans.length > 0 ? (
        <Text style={styles.or}>{t('paywall.or')}</Text>
      ) : null}

      {bundlePlans.map((plan) => (
        <BundleCard
          key={plan.id}
          plan={plan}
          selected={plan.id === selectedId}
          onSelect={() => setSelectedId(plan.id)}
        />
      ))}

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Button
        label={busy ? t('common.loading') : t(CTA_KEY[data.product.code])}
        variant="gold"
        loading={busy}
        disabled={!selectedId}
        onPress={() => void checkout()}
        style={{ marginTop: spacing[3] }}
      />

      <Pressable accessibilityRole="button" onPress={() => void restore()} style={styles.restore}>
        <Text style={styles.restoreText}>{t('paywall.restore')}</Text>
      </Pressable>

      <Text style={styles.renewNotice}>{t('paywall.renewNotice')}</Text>

      <BenefitList benefits={data.product.benefits} />

      <Text style={styles.legal}>
        {data.legal.minimumAge}+ · {data.legal.disclaimer}
      </Text>

      <View style={styles.legalLinks}>
        <Pressable onPress={() => router.push('/legal/terms' as never)}>
          <Text style={styles.legalLink}>{t('paywall.terms')}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/legal/privacy' as never)}>
          <Text style={styles.legalLink}>{t('paywall.privacy')}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/legal/responsible-gambling' as never)}>
          <Text style={styles.legalLink}>{t('legal.responsible')}</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => void Linking.openURL('https://www.bzga.de/service/beratungsstellen/')}
      >
        <Text style={styles.helpline}>{t('legal.helpLine')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[4], paddingBottom: spacing[8] },
  hero: { alignItems: 'center', gap: spacing[2], paddingTop: spacing[4] },
  heroIcons: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  heroPlus: { color: colors.text.muted, fontSize: fontSize.md },
  heroTitle: {
    color: colors.text.primary,
    fontSize: fontSize.xl,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: fontSize.xl * 1.3,
    paddingHorizontal: spacing[4],
  },
  panel: { padding: sizes.cardPadding },
  panelTitle: { color: colors.text.primary, fontSize: fontSize.lg, fontWeight: '700' },
  panelRow: {
    marginTop: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[4],
  },
  panelLabel: { flex: 1, color: colors.text.primary, fontSize: fontSize.md, fontWeight: '600' },
  panelNote: {
    marginTop: spacing[4],
    color: colors.text.muted,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.5,
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold[400],
    borderWidth: 1,
    borderColor: colors.gold[300],
    paddingHorizontal: 4,
  },
  circleText: { color: colors.text.onGold, fontWeight: '800', textAlign: 'center' },
  planRow: { flexDirection: 'row', gap: spacing[2] },
  planCard: {
    flex: 1,
    alignItems: 'center',
    gap: spacing[1],
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing[2],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
  },
  planCardIdle: { borderColor: colors.border.subtle, backgroundColor: colors.bg.card },
  planCardSelected: { borderColor: colors.gold.DEFAULT, backgroundColor: colors.bg.cardAlt },
  planMonths: { color: colors.text.secondary, fontSize: fontSize.sm, fontWeight: '600' },
  planPrice: { color: colors.text.primary, fontSize: fontSize.lg, fontWeight: '800' },
  planRibbon: {
    marginTop: spacing[1],
    width: '100%',
    backgroundColor: colors.gold.DEFAULT,
    borderRadius: radii.xs,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  planRibbonText: {
    color: colors.text.onGold,
    fontSize: fontSize.xs,
    fontWeight: '700',
    textAlign: 'center',
  },
  planRibbonSpacer: { height: 25, marginTop: spacing[1] },
  planTrial: { color: colors.accent.DEFAULT, fontSize: fontSize['2xs'] },
  or: {
    textAlign: 'center',
    color: colors.text.secondary,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  bundle: {
    backgroundColor: colors.gold.DEFAULT,
    borderRadius: radii.md,
    padding: spacing[4],
    borderWidth: 2,
    borderColor: 'transparent',
  },
  bundleSelected: { borderColor: 'rgba(255,255,255,0.75)' },
  bundleBadge: { position: 'absolute', top: -10, right: spacing[3], zIndex: 2 },
  bundleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  bundleLeft: { flex: 1, minWidth: 0 },
  bundleSave: { color: colors.text.onGold, fontSize: fontSize.sm, fontWeight: '600' },
  bundleIcons: { flexDirection: 'row', gap: spacing[1.5], marginTop: spacing[1] },
  bundleName: {
    marginTop: spacing[1],
    color: colors.text.onGold,
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  bundleRight: { alignItems: 'flex-end' },
  bundleMonths: { color: colors.text.onGold, fontSize: fontSize.sm, fontWeight: '600' },
  bundlePrice: { color: colors.text.onGold, fontSize: fontSize['2xl'], fontWeight: '800' },
  error: {
    backgroundColor: `${colors.status.LOST}26`,
    color: colors.status.LOST,
    fontSize: fontSize.sm,
    borderRadius: radii.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  restore: { alignSelf: 'center', paddingVertical: spacing[2] },
  restoreText: {
    color: colors.text.secondary,
    fontSize: fontSize.base,
    textDecorationLine: 'underline',
  },
  renewNotice: {
    textAlign: 'center',
    color: colors.text.muted,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  benefitsTitle: { color: colors.text.primary, fontSize: fontSize.md, fontWeight: '700' },
  benefitRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] },
  benefitText: { flex: 1, color: colors.text.secondary, fontSize: fontSize.base, lineHeight: 19 },
  legal: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
    borderRadius: radii.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    color: colors.text.muted,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.6,
    textAlign: 'center',
  },
  legalLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing[5] },
  legalLink: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    textDecorationLine: 'underline',
  },
  helpline: { textAlign: 'center', color: colors.text.muted, fontSize: fontSize.xs },
});
