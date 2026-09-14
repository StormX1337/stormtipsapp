# Language

The product ships **English only**. This page says what that means in the code,
and what it would take to ship a second language again.

## Where the language lives

| Layer                           | Source                                    |
| ------------------------------- | ----------------------------------------- |
| Interface strings (web, mobile) | `packages/ui/src/i18n/en.ts`              |
| Legal documents                 | `packages/ui/src/legal.ts`                |
| Push notification copy          | `packages/notifications/src/templates.ts` |
| Transactional email             | `apps/api/src/lib/mailer.ts`              |
| Editorial content               | The database, authored through the admin  |
| The admin console               | Written in English in the components      |

Editorial content — products, plans, promotions, polls, market names, tips and
combos — is authored in English in the ordinary columns. There is no override
column and no per-request language: the server returns what was authored.

`Accept-Language` is not read. A visitor whose browser prefers another language
gets the English page rather than blank fields, which is the behaviour the API
tests assert.

## The pieces that remain

`packages/types/src/localization.ts` still defines `SUPPORTED_LOCALES` (one
entry), `DEFAULT_LOCALE` and `toSupportedLocale`, which folds any regional tag
onto a supported locale. `packages/ui/src/i18n/index.ts` still resolves a
catalogue by locale, and `intlLocale` in `packages/ui/src/format.ts` maps the
app locale onto the tag `Intl` formats with.

None of that is ceremony for its own sake: it is the seam a second language
would come back through, and it costs nothing while there is one.

## Content rules

- The product must not promise profit. A unit test scans the catalogue, the
  legal documents and the push templates for guarantee wording and fails on a
  hit; see [responsible-gambling.md](responsible-gambling.md).
- Betting terminology stays in the industry's English form (`OVER 2.5 GOALS`,
  `BTTS`), including inside otherwise plain-language copy.

## Adding a second language back

1. Add the locale to `SUPPORTED_LOCALES` in `packages/types/src/localization.ts`.
2. Add a catalogue next to `packages/ui/src/i18n/en.ts` and register it in
   `index.ts`; `missingKeys` reports what is not yet translated.
3. Add the locale's entry to `legalDocuments` and `LEGAL_FOOTNOTE` in
   `packages/ui/src/legal.ts`, and to the push catalogue in
   `packages/notifications/src/templates.ts`.
4. Add its tag to `intlLocale` in `packages/ui/src/format.ts`.
5. For editorial content, restore a per-locale override column. The shape that
   was used before is in the history of this file: a `translations` JSON column
   per table, `{ "de": { "name": "…" } }`, read through `localizedString` /
   `localizedList`, with a missing or blank override falling back to the
   column. `20260914170000_english_only_content` is the migration that removed
   it and shows exactly which tables and fields were involved.
6. Resolve the request language in `apps/api/src/plugins/auth.ts` and pass it
   into the serializers, and add `accept-language` back to the `Vary` header in
   `apps/api/src/lib/http.ts` so a cached response is not served to the wrong
   reader.

## Verifying it

```bash
pnpm test                       # catalogue completeness, content language, compliance wording
curl -s localhost:4000/api/v1/billing/paywall/combo | jq .product.tagline
curl -s -H 'accept-language: de' localhost:4000/api/v1/billing/products \
  | jq '.items[] | select(.code=="COMBO") | .tagline'   # English either way
```
