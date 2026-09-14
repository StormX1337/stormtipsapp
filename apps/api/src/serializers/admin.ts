import { localizedString, translationBundle } from '@storm-tips/types';
import type {
  ComboDTO,
  FixOddsPlanDTO,
  PollDTO,
  PromotionDTO,
  SubscriptionPlanDTO,
  TipDTO,
} from '@storm-tips/types';

/**
 * Admin variants of the serializers.
 *
 * These attach the raw `translations` bundle so the editors can pre-fill the
 * second language. The public serializers deliberately omit it: a locked tip's
 * analysis must not be reachable through its translation.
 */
type WithTranslations = { translations?: unknown };

function withTranslations<T extends object>(dto: T, row: WithTranslations): T {
  return { ...dto, translations: translationBundle(row.translations) };
}

export function adminTip(dto: TipDTO, row: WithTranslations): TipDTO {
  return withTranslations(dto, row);
}

export function adminCombo(dto: ComboDTO, row: WithTranslations): ComboDTO {
  return withTranslations(dto, row);
}

export function adminPlan(dto: SubscriptionPlanDTO, row: WithTranslations): SubscriptionPlanDTO {
  return withTranslations(dto, row);
}

export function adminFixOddsPlan(dto: FixOddsPlanDTO, row: WithTranslations): FixOddsPlanDTO {
  return withTranslations(dto, row);
}

export function adminPromotion(dto: PromotionDTO, row: WithTranslations): PromotionDTO {
  return withTranslations(dto, row);
}

export function adminPoll(dto: PollDTO, row: WithTranslations): PollDTO {
  return withTranslations(dto, row);
}

/**
 * Coupons are staff-facing only — they have no public DTO, so the admin routes
 * return the row as stored and this only localises the one human-readable
 * field on it.
 */
export function adminCoupon<T extends WithTranslations & { description: string | null }>(
  row: T,
  locale: string,
): T {
  return {
    ...row,
    description: localizedString(row, locale, 'description', row.description),
    translations: translationBundle(row.translations),
  };
}
