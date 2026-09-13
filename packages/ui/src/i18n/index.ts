import { en, type MessageKey, type Messages } from './en.js';
import { de } from './de.js';
import type { SupportedLocale } from '../types.js';

export type { MessageKey, Messages };
export { en, de };

export const catalogues: Record<SupportedLocale, Messages> = { de, en };

export const DEFAULT_LOCALE: SupportedLocale = 'de';

export function isSupportedLocale(value: string): value is SupportedLocale {
  return value === 'de' || value === 'en';
}

export function resolveLocale(candidate?: string | null): SupportedLocale {
  if (!candidate) return DEFAULT_LOCALE;
  const short = candidate.split('-')[0]?.toLowerCase() ?? '';
  return isSupportedLocale(short) ? short : DEFAULT_LOCALE;
}

export type TranslateValues = Record<string, string | number>;

/**
 * Interpolates `{placeholders}`. Missing keys fall back to the English
 * catalogue and, failing that, to the key itself so nothing ever renders blank.
 */
export function translate(
  locale: SupportedLocale,
  key: MessageKey,
  values?: TranslateValues,
): string {
  const template = catalogues[locale]?.[key] ?? en[key] ?? key;
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match,
  );
}

/** Convenience factory: `const t = createTranslator('de'); t('nav.free')`. */
export function createTranslator(locale: SupportedLocale) {
  return (key: MessageKey, values?: TranslateValues) => translate(locale, key, values);
}

export type Translator = ReturnType<typeof createTranslator>;

/** Dev helper used by a unit test to guarantee catalogue parity. */
export function missingKeys(locale: SupportedLocale): MessageKey[] {
  const catalogue = catalogues[locale];
  return (Object.keys(en) as MessageKey[]).filter((key) => !catalogue[key]);
}
