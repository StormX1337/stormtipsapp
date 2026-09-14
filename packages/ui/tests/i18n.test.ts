import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  LEGAL_SLUGS,
  catalogues,
  createTranslator,
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
} from '../src/index.js';

describe('message catalogues', () => {
  it('has no key missing from the catalogue it ships', () => {
    expect(missingKeys('en')).toEqual([]);
  });

  it('never leaves a message blank', () => {
    for (const [locale, catalogue] of Object.entries(catalogues)) {
      for (const [key, message] of Object.entries(catalogue)) {
        expect(message.trim(), `${locale}.${key}`).not.toBe('');
      }
    }
  });

  it('leaves no placeholder unclosed', () => {
    for (const [key, message] of Object.entries(en)) {
      expect(message.match(/\{/g)?.length ?? 0, key).toBe(message.match(/\}/g)?.length ?? 0);
    }
  });

  /**
   * The product must not promise profit. Guarantee wording is a compliance
   * defect, so the catalogues are checked for it.
   */
  it('makes no guarantee of winnings', () => {
    const forbidden = [
      /guaranteed (profit|win)/i,
      /risk[- ]free money/i,
      /100\s*% win/i,
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

  it('interpolates values', () => {
    expect(translate('en', 'paywall.perMonth', { price: '£9.99' })).toContain('£9.99');
    expect(translate('en', 'stats.successRateLastDays', { days: 30 })).toContain('30');
    // An unknown placeholder is left untouched rather than rendering "undefined".
    expect(translate('en', 'paywall.perMonth', {})).toContain('{price}');
  });

  it('resolves locales from device tags', () => {
    expect(resolveLocale('en-GB')).toBe('en');
    // Anything the product does not ship folds onto the one it does.
    expect(resolveLocale('de-AT')).toBe(DEFAULT_LOCALE);
    expect(resolveLocale('fr-FR')).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(null)).toBe(DEFAULT_LOCALE);
    expect(isSupportedLocale('en')).toBe(true);
    expect(isSupportedLocale('de')).toBe(false);
  });

  it('exposes a bound translator', () => {
    const t = createTranslator('en');
    expect(t('nav.free')).toBe(en['nav.free']);
  });
});

describe('legal documents', () => {
  it('exist for every slug', () => {
    for (const slug of LEGAL_SLUGS) {
      const document = getLegalDocument(DEFAULT_LOCALE, slug);
      expect(document.slug).toBe(slug);
      expect(document.title.trim()).not.toBe('');
      expect(document.blocks.length).toBeGreaterThan(0);
    }
  });

  it('validates slugs', () => {
    expect(isLegalSlug('terms')).toBe(true);
    expect(isLegalSlug('impressum')).toBe(false);
  });

  it('never contains an empty block', () => {
    for (const document of Object.values(legalDocuments[DEFAULT_LOCALE])) {
      for (const block of document.blocks) {
        if (block.type === 'ul') {
          expect(block.items.length).toBeGreaterThan(0);
          for (const item of block.items) expect(item.trim()).not.toBe('');
        } else {
          expect(block.text.trim()).not.toBe('');
        }
      }
    }
  });

  it('states plainly that nothing is guaranteed', () => {
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
    expect(formatMoney(2999, 'EUR')).toBe('€29.99');
    expect(formatMoney(2999, 'GBP', 'en')).toBe('£29.99');
  });

  it('formats odds with two decimals and a dash when unknown', () => {
    expect(formatOdds(1.3)).toBe('1.30');
    expect(formatOdds('3.2')).toBe('3.20');
    expect(formatOdds(null)).toBe('—');
    expect(formatOdds(Number.NaN)).toBe('—');
  });

  it('formats units, percentages and compact numbers', () => {
    expect(formatUnits(124.5)).toBe('124.50');
    expect(formatSignedUnits(12, 'en')).toBe('+12.00');
    expect(formatSignedUnits(-12, 'en')).toBe('-12.00');
    expect(formatPercent(62.94, 'en')).toBe('62.9%');
    expect(formatCompact(5025, 'en')).toMatch(/^5[kK]$/);
  });

  it('formats kickoff times in the requested zone', () => {
    expect(formatKickoff('2026-03-01T18:30:00.000Z', 'Europe/Berlin')).toBe('19:30');
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
