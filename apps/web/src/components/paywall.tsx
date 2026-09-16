'use client';

import clsx from 'clsx';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Check, Crown, ShieldCheck, Ticket, Zap } from 'lucide-react';
import type { ProductCode, PromotionDTO, SubscriptionPlanDTO } from '@storm-tips/types';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button, PromoBadge } from './primitives';
import { intlLocale } from '@storm-tips/ui';

export interface PaywallStatistics {
  days: number;
  successfulAnalyses: number;
  returnOnStake: number;
  roi: number;
  averageOdds: number;
  winRate: number;
  totalTips: number;
  profit: number;
  /** Flat theoretical stake the figures were computed with. */
  stake: number;
}

/**
 * Statistic circle.
 *
 * The reference design scales the circle with the importance of the metric —
 * the headline number is visibly larger than the supporting ones.
 */
export function StatCircle({
  value,
  size = 'md',
}: {
  value: string;
  size?: 'sm' | 'md' | 'lg';
}): ReactNode {
  const dimension = size === 'lg' ? 84 : size === 'md' ? 64 : 54;
  const fontSize =
    value.length > 6 ? dimension * 0.2 : value.length > 4 ? dimension * 0.24 : dimension * 0.3;
  return (
    <span
      className="stat-circle shrink-0"
      style={{ width: dimension, height: dimension, fontSize }}
    >
      {value}
    </span>
  );
}

export function StatCirclePanel({ statistics }: { statistics: PaywallStatistics }): ReactNode {
  const { t, locale } = useI18n();
  const numberFormat = new Intl.NumberFormat(intlLocale(locale));

  const rows: { label: string; value: string; size: 'sm' | 'md' | 'lg' }[] = [
    {
      label: t('stats.successfulAnalyses'),
      value: numberFormat.format(statistics.successfulAnalyses),
      size: 'md',
    },
    {
      /**
       * ROI, not `returnOnStake`. The latter is profit as a percentage of one
       * flat stake, so over a few hundred settled analyses it reads "9,235%" —
       * a number that sounds like a promise of riches rather than a record, and
       * one no reader would take at face value. Profit against the money
       * actually staked is the figure that means something.
       */
      label: t('stats.returnOnPurchase'),
      value: `${statistics.roi.toFixed(1)}%`,
      size: 'lg',
    },
    {
      label: t('stats.averageOdds'),
      value: statistics.averageOdds.toFixed(2),
      size: 'sm',
    },
  ];

  return (
    <section className="card p-4">
      <h2 className="text-[15px] font-bold">
        {t('stats.successRateLastDays', { days: statistics.days })}
      </h2>
      <dl className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 sm:flex-1 sm:flex-col-reverse sm:justify-start sm:gap-2 sm:text-center"
          >
            <dt className="text-[14px] font-semibold text-ink sm:text-[13px]">{row.label}</dt>
            {/* A fixed slot so three circles of different sizes still put their
                labels on one line. */}
            <dd className="sm:grid sm:h-[92px] sm:place-items-center">
              <StatCircle value={row.value} size={row.size} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[11px] leading-relaxed text-ink-dim">
        {t('stats.disclaimer', { stake: statistics.stake })}
      </p>
    </section>
  );
}

const PRODUCT_ICON: Record<ProductCode, ReactNode> = {
  FREE: <Check size={18} aria-hidden />,
  COMBO: <Ticket size={18} aria-hidden />,
  VIP: <Crown size={18} aria-hidden />,
  EXTRA: <Zap size={18} aria-hidden />,
  FIX_ODDS: <ShieldCheck size={18} aria-hidden />,
};

/** One of the three duration cards (1 / 3 / 6 months). */
export function PlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: SubscriptionPlanDTO;
  selected: boolean;
  onSelect: () => void;
}): ReactNode {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={clsx(
        'relative flex flex-1 flex-col items-center gap-1 rounded-lg border px-2 pt-3 pb-2 text-center transition-colors',
        selected
          ? 'border-gold-400 bg-bg-card-alt shadow-gold'
          : 'border-line-subtle bg-bg-card hover:border-line-strong',
      )}
    >
      <span className="text-[12px] font-semibold text-ink-muted">
        {t(plan.months === 1 ? 'paywall.months.one' : 'paywall.months.other', {
          count: plan.months,
        })}
      </span>
      <span className="text-[17px] font-extrabold text-ink">{plan.price.formatted}</span>
      {/*
        The per-month price used to sit in a solid gold bar — louder than
        anything else on the card, including the price. Since only the longer
        plans carry one, the row read as though two of the three were already
        selected and the one-month card was unfinished. Gold belongs to the
        selected state, which the border and shadow above already carry.
      */}
      {plan.pricePerMonth ? (
        <span className="mt-1 text-[11px] font-semibold text-gold-300">
          {t('paywall.perMonth', { price: plan.pricePerMonth.formatted })}
        </span>
      ) : (
        <span className="mt-1 h-[16px]" aria-hidden />
      )}
      {plan.trialDays > 0 ? (
        <span className="text-[10px] text-accent-500">
          {t('paywall.trial', { days: plan.trialDays })}
        </span>
      ) : null}
    </button>
  );
}

/** Full-width gold bundle card with the "Most Popular" flag. */
export function BundleCard({
  plan,
  selected,
  onSelect,
}: {
  plan: SubscriptionPlanDTO;
  selected: boolean;
  onSelect: () => void;
}): ReactNode {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={clsx(
        'relative w-full rounded-lg bg-gold-400 p-4 text-left text-ink-inverse transition-transform',
        selected ? 'ring-2 ring-white/70' : 'hover:brightness-105',
      )}
    >
      {plan.badge !== 'NONE' ? (
        <span className="absolute -top-2.5 right-3">
          <PromoBadge badge={plan.badge} />
        </span>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {plan.savings ? (
            <p className="text-[12px] font-semibold">
              {t('paywall.save', { amount: plan.savings.formatted })}
            </p>
          ) : null}
          <p className="mt-1 flex items-center gap-1.5">
            {plan.products.map((product) => (
              <span key={product} className="grid h-6 w-6 place-items-center">
                {PRODUCT_ICON[product]}
              </span>
            ))}
          </p>
          <p className="mt-1 text-[15px] font-extrabold">{plan.name}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[12px] font-semibold">
            {t(plan.months === 1 ? 'paywall.months.one' : 'paywall.months.other', {
              count: plan.months,
            })}
          </p>
          <p className="text-[19px] font-extrabold">{plan.price.formatted}</p>
        </div>
      </div>
    </button>
  );
}

export function PaywallHero({
  product,
  title,
}: {
  product: ProductCode;
  title: string;
}): ReactNode {
  return (
    <header className="flex flex-col items-center gap-2 pt-4 pb-5 text-center">
      <div className="flex items-center gap-2 text-gold-400">
        {PRODUCT_ICON[product]}
        <span className="text-ink-dim">+</span>
        <Crown size={18} aria-hidden />
      </div>
      <h2 className="max-w-sm text-[19px] leading-snug font-extrabold text-balance">{title}</h2>
    </header>
  );
}

export function BenefitList({ benefits }: { benefits: string[] }): ReactNode {
  const { t } = useI18n();
  if (benefits.length === 0) return null;
  return (
    <section className="card p-4">
      <h3 className="text-[14px] font-bold">{t('paywall.benefits')}</h3>
      <ul className="mt-3 flex flex-col gap-2">
        {benefits.map((benefit) => (
          <li key={benefit} className="flex items-start gap-2 text-[13px] text-ink-muted">
            <Check size={15} className="mt-0.5 shrink-0 text-accent-500" aria-hidden />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LegalLinks(): ReactNode {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 py-6 text-[12px] underline decoration-ink-dim/60 underline-offset-4">
      <Link href="/legal/terms" className="text-ink-muted hover:text-ink">
        {t('paywall.terms')}
      </Link>
      <Link href="/legal/privacy" className="text-ink-muted hover:text-ink">
        {t('paywall.privacy')}
      </Link>
      <Link href="/legal/responsible-gambling" className="text-ink-muted hover:text-ink">
        {t('legal.responsible')}
      </Link>
    </div>
  );
}

export interface PaywallData {
  product: { code: ProductCode; name: string; tagline: string | null; benefits: string[] };
  unlocked: boolean;
  plans: SubscriptionPlanDTO[];
  promotions: PromotionDTO[];
  statistics: PaywallStatistics;
  legal: { minimumAge: number; disclaimer: string };
}

/**
 * Full paywall.
 *
 * Reproduces the reference layout: hero, verified statistics panel, the
 * duration cards, the "or" separator and the bundle offer, then the legal row.
 */
export function Paywall({ data }: { data: PaywallData }): ReactNode {
  const { t } = useI18n();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string>(
    () => data.plans.find((plan) => plan.isPopular)?.id ?? data.plans[0]?.id ?? '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bundlePlans = data.plans.filter((plan) => plan.products.length > 1);
  const singlePlans = data.plans.filter((plan) => plan.products.length === 1);

  const titleKey =
    data.product.code === 'COMBO'
      ? 'paywall.comboTitle'
      : data.product.code === 'VIP'
        ? 'paywall.vipTitle'
        : data.product.code === 'EXTRA'
          ? 'paywall.extraTitle'
          : 'paywall.fixOddsTitle';

  const ctaKey =
    data.product.code === 'COMBO'
      ? 'paywall.getCombo'
      : data.product.code === 'VIP'
        ? 'paywall.getVip'
        : data.product.code === 'EXTRA'
          ? 'paywall.getExtra'
          : 'paywall.getFixOdds';

  async function checkout(): Promise<void> {
    setError(null);
    if (!user) {
      window.location.href = `/auth/login?next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    setBusy(true);
    try {
      const response = await api<{ checkoutUrl: string }>('/billing/checkout', {
        method: 'POST',
        body: { planId: selectedId },
      });
      window.location.href = response.checkoutUrl;
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <PaywallHero product={data.product.code} title={t(titleKey)} />

      <StatCirclePanel statistics={data.statistics} />

      {singlePlans.length > 0 ? (
        <div className="flex gap-2">
          {singlePlans.slice(0, 3).map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              selected={plan.id === selectedId}
              onSelect={() => setSelectedId(plan.id)}
            />
          ))}
        </div>
      ) : null}

      {bundlePlans.length > 0 && singlePlans.length > 0 ? (
        <p className="text-center text-[14px] font-bold text-ink-muted">{t('paywall.or')}</p>
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
        <p role="alert" className="rounded-md bg-lost/15 px-3 py-2 text-[12px] text-lost">
          {error}
        </p>
      ) : null}

      <Button variant="gold" size="lg" onClick={checkout} disabled={busy || !selectedId}>
        {busy ? t('common.loading') : t(ctaKey)}
      </Button>

      <p className="text-center text-[11px] text-ink-dim">{t('paywall.renewNotice')}</p>

      <BenefitList benefits={data.product.benefits} />

      <p className="rounded-md border border-line-subtle px-3 py-2 text-center text-[11px] text-ink-dim">
        {data.legal.minimumAge}+ · {data.legal.disclaimer}
      </p>

      <LegalLinks />
    </div>
  );
}
