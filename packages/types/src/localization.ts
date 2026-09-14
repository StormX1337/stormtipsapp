/** The interface languages the product ships. */
export const SUPPORTED_LOCALES = ['de', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'de';

/**
 * Content localisation.
 *
 * Editorial rows (products, plans, promotions, polls, tips, combos) keep their
 * authored text in ordinary columns and carry per-locale overrides in a
 * `translations` JSON column:
 *
 * ```json
 * { "en": { "name": "Storm Tips Combo", "tagline": "Curated accumulators" } }
 * ```
 *
 * The base columns hold the primary language, so a row with no override — or
 * with only some fields translated — still renders completely. That is the
 * point: a half-finished translation degrades to the original text rather than
 * to a blank screen.
 */
export type TranslationBundle = Record<string, Record<string, unknown>>;

export interface TranslatableRow {
  translations?: unknown;
}

/** Narrows the untyped Prisma `Json` column to the shape above. */
export function translationBundle(value: unknown): TranslationBundle {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const bundle: TranslationBundle = {};
  for (const [locale, fields] of Object.entries(value as Record<string, unknown>)) {
    if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
      bundle[locale] = fields as Record<string, unknown>;
    }
  }
  return bundle;
}

function overrideFor(row: TranslatableRow, locale: string): Record<string, unknown> {
  const bundle = translationBundle(row.translations);
  // "en-GB" and "en" address the same catalogue.
  const short = locale.split('-')[0]?.toLowerCase() ?? '';
  return bundle[locale] ?? bundle[short] ?? {};
}

/**
 * Reads one string field in the requested locale.
 * An override that is missing, empty or not a string falls back to the column.
 */
export function localizedString<T extends string | null | undefined>(
  row: TranslatableRow,
  locale: string,
  field: string,
  fallback: T,
): T | string {
  const value = overrideFor(row, locale)[field];
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  return value;
}

/** Reads one string-array field (for example a product's benefit list). */
export function localizedList(
  row: TranslatableRow,
  locale: string,
  field: string,
  fallback: string[],
): string[] {
  const value = overrideFor(row, locale)[field];
  if (!Array.isArray(value)) return fallback;
  const entries = value.filter(
    (entry): entry is string => typeof entry === 'string' && entry.trim() !== '',
  );
  return entries.length > 0 ? entries : fallback;
}

/**
 * Builds a localiser bound to one row and locale, which reads better than
 * repeating the row and locale on every field.
 */
export function localizer(row: TranslatableRow, locale: string) {
  return {
    text<T extends string | null | undefined>(field: string, fallback: T): T | string {
      return localizedString(row, locale, field, fallback);
    },
    list(field: string, fallback: string[]): string[] {
      return localizedList(row, locale, field, fallback);
    },
  };
}

/** Normalises anything a client sends into a supported locale. */
export function toSupportedLocale(value: string | null | undefined): SupportedLocale {
  if (!value) return DEFAULT_LOCALE;
  const short = value.split('-')[0]?.toLowerCase() ?? '';
  return (SUPPORTED_LOCALES as readonly string[]).includes(short)
    ? (short as SupportedLocale)
    : DEFAULT_LOCALE;
}

/**
 * Merges an incoming translation patch into a stored bundle.
 *
 * Admin forms submit only the locale they are editing; a field cleared to an
 * empty string removes the override so the row falls back to the base column
 * instead of rendering blank.
 */
export function mergeTranslations(
  current: unknown,
  patch: Record<string, Record<string, unknown>>,
): TranslationBundle {
  const merged = translationBundle(current);
  for (const [locale, fields] of Object.entries(patch)) {
    const target = { ...(merged[locale] ?? {}) };
    for (const [field, value] of Object.entries(fields)) {
      const empty =
        value === null ||
        value === undefined ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0);
      if (empty) delete target[field];
      else target[field] = value;
    }
    if (Object.keys(target).length > 0) merged[locale] = target;
    else delete merged[locale];
  }
  return merged;
}
