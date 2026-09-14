import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  localizedList,
  localizedString,
  localizer,
  mergeTranslations,
  toSupportedLocale,
  translationBundle,
} from '../src/index.js';

const row = {
  name: 'Storm Tips Combo',
  tagline: 'Kuratierte Kombiwetten',
  benefits: ['Tägliche Kombi-Analysen'],
  translations: {
    en: {
      name: 'Storm Tips Combo',
      tagline: 'Curated accumulators',
      benefits: ['Daily accumulator analyses'],
    },
  },
};

describe('translationBundle', () => {
  it('accepts a well-formed bundle', () => {
    expect(translationBundle({ en: { name: 'x' } })).toEqual({ en: { name: 'x' } });
  });

  it('ignores anything that is not a map of locales to field maps', () => {
    expect(translationBundle(null)).toEqual({});
    expect(translationBundle('nope')).toEqual({});
    expect(translationBundle([{ en: {} }])).toEqual({});
    expect(translationBundle({ en: 'not-an-object' })).toEqual({});
    expect(translationBundle({ en: ['array'] })).toEqual({});
  });
});

describe('localizedString', () => {
  it('returns the override for the requested locale', () => {
    expect(localizedString(row, 'en', 'tagline', row.tagline)).toBe('Curated accumulators');
  });

  it('falls back to the column when the locale has no entry', () => {
    expect(localizedString(row, 'de', 'tagline', row.tagline)).toBe('Kuratierte Kombiwetten');
    expect(localizedString(row, 'fr', 'tagline', row.tagline)).toBe('Kuratierte Kombiwetten');
  });

  it('falls back when the override is missing, blank or the wrong type', () => {
    const partial = { translations: { en: { name: '   ', tagline: 42 } } };
    expect(localizedString(partial, 'en', 'name', 'Fallback')).toBe('Fallback');
    expect(localizedString(partial, 'en', 'tagline', 'Fallback')).toBe('Fallback');
    expect(localizedString(partial, 'en', 'missing', 'Fallback')).toBe('Fallback');
  });

  it('keeps a null column null rather than inventing text', () => {
    expect(localizedString({ translations: {} }, 'en', 'description', null)).toBeNull();
  });

  it('treats a regional tag as its base language', () => {
    expect(localizedString(row, 'en-GB', 'tagline', row.tagline)).toBe('Curated accumulators');
  });
});

describe('localizedList', () => {
  it('returns the translated list', () => {
    expect(localizedList(row, 'en', 'benefits', row.benefits)).toEqual([
      'Daily accumulator analyses',
    ]);
  });

  it('falls back for a missing, empty or non-array override', () => {
    expect(localizedList(row, 'de', 'benefits', row.benefits)).toEqual(row.benefits);
    expect(
      localizedList({ translations: { en: { benefits: [] } } }, 'en', 'benefits', ['a']),
    ).toEqual(['a']);
    expect(
      localizedList({ translations: { en: { benefits: 'nope' } } }, 'en', 'benefits', ['a']),
    ).toEqual(['a']);
  });

  it('drops blank entries but keeps the rest', () => {
    const mixed = { translations: { en: { benefits: ['Kept', '  ', 7] } } };
    expect(localizedList(mixed, 'en', 'benefits', ['fallback'])).toEqual(['Kept']);
  });
});

describe('localizer', () => {
  it('binds a row and locale', () => {
    const text = localizer(row, 'en');
    expect(text.text('name', row.name)).toBe('Storm Tips Combo');
    expect(text.list('benefits', row.benefits)).toEqual(['Daily accumulator analyses']);
  });
});

describe('toSupportedLocale', () => {
  it('accepts the languages the product ships', () => {
    for (const locale of SUPPORTED_LOCALES) expect(toSupportedLocale(locale)).toBe(locale);
    expect(toSupportedLocale('en-GB')).toBe('en');
    // A language the product no longer ships folds onto the one it does.
    expect(toSupportedLocale('DE-at')).toBe(DEFAULT_LOCALE);
  });

  it('falls back to the default for anything else', () => {
    expect(toSupportedLocale('fr')).toBe(DEFAULT_LOCALE);
    expect(toSupportedLocale('')).toBe(DEFAULT_LOCALE);
    expect(toSupportedLocale(null)).toBe(DEFAULT_LOCALE);
    expect(toSupportedLocale(undefined)).toBe(DEFAULT_LOCALE);
  });
});

describe('mergeTranslations', () => {
  it('merges a patch into the stored bundle without dropping other locales', () => {
    const merged = mergeTranslations(
      { de: { name: 'Deutsch' }, en: { name: 'English', tagline: 'Keep me' } },
      { en: { name: 'Updated' } },
    );
    expect(merged).toEqual({
      de: { name: 'Deutsch' },
      en: { name: 'Updated', tagline: 'Keep me' },
    });
  });

  it('removes a field that was cleared, so the row falls back to its column', () => {
    const merged = mergeTranslations(
      { en: { name: 'English', tagline: 'Gone' } },
      {
        en: { tagline: '   ' },
      },
    );
    expect(merged).toEqual({ en: { name: 'English' } });
  });

  it('removes the locale entirely once its last field is cleared', () => {
    expect(mergeTranslations({ en: { name: 'English' } }, { en: { name: '' } })).toEqual({});
  });

  it('starts from an empty bundle when nothing is stored', () => {
    expect(mergeTranslations(null, { en: { name: 'New' } })).toEqual({ en: { name: 'New' } });
    expect(mergeTranslations('garbage', { en: { name: 'New' } })).toEqual({ en: { name: 'New' } });
  });

  it('ignores empty arrays the same way as empty strings', () => {
    expect(mergeTranslations({ en: { benefits: ['a'] } }, { en: { benefits: [] } })).toEqual({});
  });
});
