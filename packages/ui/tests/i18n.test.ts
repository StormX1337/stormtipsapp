import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  LEGAL_SLUGS,
  catalogues,
  createTranslator,
  de,
  en,
  formatCompact,
  formatKickoff,
  formatMoney,
  formatOdds,
  formatPercent,
  formatSignedUnits,
  formatUnits,
  getLegalDocument,
  isLegalSlug,
  isSupportedLocale,
  legalDocuments,
  maskEmail,
  missingKeys,
  resolveLocale,
  toDateKey,
  translate,
  type MessageKey,
} from '../src/index.js';

describe('message catalogues', () => {
  it('define the same keys in every language', () => {
    expect(missingKeys('de')).toEqual([]);
    expect(missingKeys('en')).toEqual([]);
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  });

  it('never leaves a message blank', () => {
    for (const [locale, catalogue] of Object.entries(catalogues)) {
      for (const [key, message] of Object.entries(catalogue)) {
        expect(message.trim(), `${locale}.${key}`).not.toBe('');
      }
    }
  });

  it('keeps placeholders consistent across languages', () => {
    const placeholders = (value: string): string[] =>
      [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1] as string).sort();

    for (const key of Object.keys(en) as MessageKey[]) {
      expect(placeholders(de[key]), key).toEqual(placeholders(en[key]));
    }
  });

  /**
   * The product must not promise profit. Guarantee wording is a compliance
   * defect, so the catalogues are checked for it.
   */
  it('makes no guarantee of winnings', () => {
    const forbidden = [
      /garantierte?r? gewinn/i,
      /gewinn garantiert/i,
      /risikofrei(?!e?“)/i,
      /guaranteed (profit|win)/i,
      /risk[- ]free money/i,
      /100\s*% (win|trefferquote)/i,
      /sichere wette/i,
      /sure win/i,
    ];

    for (const [locale, catalogue] of Object.entries(catalogues)) {
      for (const [key, message] of Object.entries(catalogue)) {
        for (const pattern of forbidden) {
          expect(pattern.test(message), `${locale}.${key}: ${message}`).toBe(false);
        }
      }
    }
  });

  it('interpolates values and falls back to English', () => {
    expect(translate('de', 'paywall.perMonth', { price: '9,99 €' })).toContain('9,99 €');
    expect(translate('en', 'stats.successRateLastDays', { days: 30 })).toContain('30');
    // An unknown placeholder is left untouched rather than rendering "undefined".
    expect(translate('de', 'paywall.perMonth', {})).toContain('{price}');
  });

  it('resolves locales from device tags', () => {
    expect(resolveLocale('de-AT')).toBe('de');
    expect(resolveLocale('en-GB')).toBe('en');
    expect(resolveLocale('fr-FR')).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(null)).toBe(DEFAULT_LOCALE);
    expect(isSupportedLocale('de')).toBe(true);
    expect(isSupportedLocale('fr')).toBe(false);
  });

  it('exposes a bound translator', () => {
    const t = createTranslator('en');
    expect(t('nav.free')).toBe(en['nav.free']);
  });
});

describe('legal documents', () => {
  it('exist in both languages for every slug', () => {
    for (const slug of LEGAL_SLUGS) {
      for (const locale of ['de', 'en'] as const) {
        const document = getLegalDocument(locale, slug);
        expect(document.slug).toBe(slug);
        expect(document.title.trim()).not.toBe('');
        expect(document.blocks.length).toBeGreaterThan(0);
      }
    }
  });

  it('validates slugs', () => {
    expect(isLegalSlug('terms')).toBe(true);
    expect(isLegalSlug('impressum')).toBe(false);
  });

  it('never contains an empty block', () => {
    for (const locale of ['de', 'en'] as const) {
      for (const document of Object.values(legalDocuments[locale])) {
        for (const block of document.blocks) {
          if (block.type === 'ul') {
            expect(block.items.length).toBeGreaterThan(0);
            for (const item of block.items) expect(item.trim()).not.toBe('');
          } else {
            expect(block.text.trim()).not.toBe('');
          }
        }
      }
    }
  });

  it('states plainly that nothing is guaranteed', () => {
    expect(
      getLegalDocument('de', 'responsible-gambling')
        .blocks.filter((block) => block.type === 'ul')
        .flatMap((block) => (block.type === 'ul' ? block.items : []))
        .join(' '),
    ).toMatch(/Keine garantierten Gewinne/i);

    expect(
      getLegalDocument('en', 'responsible-gambling')
        .blocks.filter((block) => block.type === 'ul')
        .flatMap((block) => (block.type === 'ul' ? block.items : []))
        .join(' '),
    ).toMatch(/No guaranteed profit/i);
  });
});

describe('formatters', () => {
  it('formats money from minor units', () => {
    // Intl inserts a narrow no-break space before the currency symbol.
    expect(formatMoney(2999, 'EUR', 'de').replace(/\s/g, ' ')).toBe('29,99 \u20ac');
    expect(formatMoney(2999, 'GBP', 'en')).toBe('£29.99');
  });

  it('formats odds with two decimals and a dash when unknown', () => {
    expect(formatOdds(1.3)).toBe('1.30');
    expect(formatOdds('3.2')).toBe('3.20');
    expect(formatOdds(null)).toBe('—');
    expect(formatOdds(Number.NaN)).toBe('—');
  });

  it('formats units, percentages and compact numbers', () => {
    expect(formatUnits(124.5, 'de')).toBe('124,50');
    expect(formatSignedUnits(12, 'en')).toBe('+12.00');
    expect(formatSignedUnits(-12, 'en')).toBe('-12.00');
    expect(formatPercent(62.94, 'en')).toBe('62.9%');
    expect(formatCompact(5025, 'en')).toMatch(/^5[kK]$/);
  });

  it('formats kickoff times in the requested zone', () => {
    expect(formatKickoff('2026-03-01T18:30:00.000Z', 'Europe/Berlin', 'de')).toBe('19:30');
    expect(formatKickoff('2026-03-01T18:30:00.000Z', 'UTC', 'en')).toBe('18:30');
  });

  it('builds date keys in the requested zone', () => {
    expect(toDateKey('2026-03-01T23:30:00.000Z', 'Europe/Berlin')).toBe('2026-03-02');
    expect(toDateKey('2026-03-01T23:30:00.000Z', 'UTC')).toBe('2026-03-01');
  });

  it('masks an email for public display', () => {
    expect(maskEmail('spieler@example.com')).toBe('sp*****@example.com');
  });
});
