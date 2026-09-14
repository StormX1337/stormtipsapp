import type { Prisma } from '@storm-tips/database';
import { intervalMonths, pricePerMonthCents, savingsAgainstMonthly } from '@storm-tips/payments';
import { localizer } from '@storm-tips/types';
import type {
  FixOddsPlanDTO,
  PaymentDTO,
  ProductCode,
  ProductDTO,
  PromotionDTO,
  SubscriptionDTO,
  SubscriptionPlanDTO,
} from '@storm-tips/types';
import { dec, iso, money } from './common.js';

/**
 * Serialises a plan, deriving every number the paywall shows (per-month price,
 * savings, badge) so the clients never compute pricing themselves.
 *
 * `monthlyReferenceCents` is the cheapest 1-month plan covering the same
 * products — it is what the "save X" line is measured against.
 */
export function serializePlan(
  plan: Prisma.SubscriptionPlanGetPayload<object>,
  locale = 'de',
  monthlyReferenceCents?: number,
): SubscriptionPlanDTO {
  const months = intervalMonths(plan.interval, plan.intervalCount);
  const perMonth = pricePerMonthCents(plan.priceCents, plan.interval, plan.intervalCount);
  const reference = monthlyReferenceCents ?? null;
  const savings = reference
    ? savingsAgainstMonthly(plan.priceCents, plan.interval, plan.intervalCount, reference)
    : null;
  const compareSavings =
    !savings && plan.compareAtPriceCents && plan.compareAtPriceCents > plan.priceCents
      ? {
          savingsCents: plan.compareAtPriceCents - plan.priceCents,
          savingsPercent: Math.round(
            ((plan.compareAtPriceCents - plan.priceCents) / plan.compareAtPriceCents) * 100,
          ),
        }
      : null;
  const effective = savings ?? compareSavings;
  const text = localizer(plan, locale);

  return {
    id: plan.id,
    slug: plan.slug,
    name: text.text('name', plan.name),
    description: text.text('description', plan.description),
    products: plan.products as ProductCode[],
    price: money(plan.priceCents, plan.currency, locale),
    compareAtPrice: plan.compareAtPriceCents
      ? money(plan.compareAtPriceCents, plan.currency, locale)
      : null,
    pricePerMonth: perMonth ? money(perMonth, plan.currency, locale) : null,
    savingsPercent: effective?.savingsPercent ?? null,
    savings: effective ? money(effective.savingsCents, plan.currency, locale) : null,
    interval: plan.interval,
    intervalCount: plan.intervalCount,
    months,
    trialDays: plan.trialDays,
    badge: plan.badge,
    highlight: text.text('highlight', plan.highlight),
    isPopular: plan.isPopular,
    stripePriceId: plan.stripePriceId,
    appleProductId: plan.appleProductId,
    googleProductId: plan.googleProductId,
  };
}

export function serializeFixOddsPlan(
  plan: Prisma.FixOddsPlanGetPayload<object>,
  locale = 'de',
): FixOddsPlanDTO {
  const text = localizer(plan, locale);
  return {
    id: plan.id,
    slug: plan.slug,
    name: text.text('name', plan.name),
    description: text.text('description', plan.description),
    price: money(plan.priceCents, plan.currency, locale),
    interval: plan.interval,
    intervalCount: plan.intervalCount,
    targetOdds: dec(plan.targetOdds) ?? 0,
    maxOdds: dec(plan.maxOdds) ?? 0,
    minConfidence: plan.minConfidence,
    picksPerPeriod: plan.picksPerPeriod,
    sportIds: plan.sportIds,
    leagueIds: plan.leagueIds,
    allowLive: plan.allowLive,
    requiresVip: plan.requiresVip,
    badge: plan.badge,
  };
}

export function serializeProduct(
  product: Prisma.ProductGetPayload<object>,
  locale = 'de',
): ProductDTO {
  const text = localizer(product, locale);
  return {
    code: product.code as ProductCode,
    name: text.text('name', product.name),
    tagline: text.text('tagline', product.tagline),
    description: text.text('description', product.description),
    icon: product.icon,
    color: product.color,
    benefits: text.list('benefits', product.benefits),
  };
}

export function serializeSubscription(
  subscription: Prisma.SubscriptionGetPayload<{ include: { plan: true } }>,
  locale = 'de',
): SubscriptionDTO {
  const end = subscription.gracePeriodEndsAt ?? subscription.currentPeriodEnd;
  return {
    id: subscription.id,
    status: subscription.status,
    provider: subscription.provider,
    products: subscription.products as ProductCode[],
    plan: subscription.plan ? serializePlan(subscription.plan, locale) : null,
    startedAt: subscription.startedAt.toISOString(),
    currentPeriodStart: iso(subscription.currentPeriodStart),
    currentPeriodEnd: iso(subscription.currentPeriodEnd),
    trialEndsAt: iso(subscription.trialEndsAt),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    canceledAt: iso(subscription.canceledAt),
    willRenew: !subscription.cancelAtPeriodEnd && subscription.status === 'ACTIVE',
    daysRemaining: end ? Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000)) : null,
  };
}

export function serializePayment(
  payment: Prisma.PaymentGetPayload<{ include: { invoice: true } }>,
  locale = 'de',
): PaymentDTO {
  return {
    id: payment.id,
    provider: payment.provider,
    status: payment.status,
    amount: money(payment.amountCents, payment.currency, locale),
    refunded: money(payment.refundedCents, payment.currency, locale),
    description: payment.description,
    paidAt: iso(payment.paidAt),
    createdAt: payment.createdAt.toISOString(),
    invoiceNumber: payment.invoice?.number ?? null,
    invoiceUrl: payment.invoice?.pdfUrl ?? null,
  };
}

export function serializePromotion(
  promotion: Prisma.PromotionGetPayload<object>,
  locale = 'de',
): PromotionDTO {
  const text = localizer(promotion, locale);
  return {
    id: promotion.id,
    title: text.text('title', promotion.title),
    subtitle: text.text('subtitle', promotion.subtitle),
    body: text.text('body', promotion.body),
    imageUrl: promotion.imageUrl,
    ctaLabel: text.text('ctaLabel', promotion.ctaLabel),
    ctaUrl: promotion.ctaUrl,
    deepLink: promotion.deepLink,
    badge: promotion.badge,
    audience: promotion.audience,
    product: promotion.product as ProductCode | null,
    planId: promotion.planId,
    gradientFrom: promotion.gradientFrom,
    gradientTo: promotion.gradientTo,
    endsAt: iso(promotion.endsAt),
  };
}
