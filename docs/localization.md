# Languages

The product ships in **German and English**, end to end: the interface, the
editorial content, push notifications, transactional email and the legal
documents.

German is the primary authoring language; English is a complete second language,
not a partial veneer.

## Two kinds of text

| Kind                                                                               | Where it lives                    | Who translates it                                                             |
| ---------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| Interface strings (labels, buttons, empty states, errors)                          | `packages/ui/src/i18n/{de,en}.ts` | Shipped with the apps; the client renders the catalogue for the active locale |
| Editorial content (products, plans, promotions, polls, market names, tips, combos) | The database                      | The server, from each row's `translations` column                             |

The split matters: a client can translate its own chrome, but it cannot
translate a tip's analysis. That has to come from the server in the right
language, which is why the locale travels with every request.

## Content translations

Localisable rows keep their authored text in ordinary columns and carry
per-locale overrides in a `translations` JSON column:

```json
{ "en": { "name": "Storm Tips Combo", "tagline": "Curated accumulators" } }
```

Columns carrying it: `products`, `subscription_plans`, `fix_odds_plans`,
`promotions`, `polls`, `poll_options`, `markets`, `tips`, `combos`.

Rules, enforced by `packages/types/src/localization.ts` and covered by its unit
tests:

- A missing locale, a missing field, an empty string or a value of the wrong
  type **falls back to the column**. A half-finished translation degrades to the
  original text, never to a blank screen.
- `en-GB` and `en` address the same catalogue.
- A field cleared in the admin form **removes** the override rather than storing
  an empty string, so the row goes back to falling back.
- Markets are the one set authored in English (the industry's terminology), so
  they carry a German override instead. The direction is per row, not global.

## How the server picks a language

`request.locale` is set for every request, signed in or not:

1. an explicit `?locale=` — what a language switcher sends;
2. otherwise the signed-in user's stored `language`;
3. otherwise `Accept-Language`, in the order the client sent it;
4. otherwise `DEFAULT_LOCALE`.

A signed-in preference only wins when the request did not ask for something
else, so a switcher works before the profile has been saved.

Cacheable responses carry `Vary: accept-language, authorization`. Without it a
browser or CDN would serve a German response to an English reader — that is not
a theoretical concern, it was observed before the header was added.

## How the clients pick a language

Both clients resolve the locale **at module load**, before the first query goes
out: the stored preference, else the device or browser language. Resolving it in
a React effect is too late — the first requests would already have gone out in
the wrong language and the answers would be served from cache rather than
refetched.

Changing the language then:

1. stores the choice locally,
2. updates the language every request carries,
3. invalidates the query cache so content is refetched, and
4. saves it to the account (`PATCH /me`), because push notifications and emails
   are rendered server-side from the stored language.

The web app also updates `<html lang>`.

## Notifications and email

Push copy is **not** composed at the call site. The caller passes a template key
and its values, and the fan-out renders the copy once per recipient language,
grouping devices accordingly:

```ts
await notifications.broadcast({
  type: 'KICKOFF_REMINDER',
  values: { minutes: 30, match: 'A – B', market: 'OVER 2.5 GOALS', tipId },
  audience: { products: ['VIP'] },
});
```

Operator-composed campaigns instead pass `title`/`body` plus optional
`translations`, so a campaign can be written in both languages and each
recipient gets theirs.

Templates live in `packages/notifications/src/templates.ts`; a test asserts both
catalogues define the same keys. Transactional email follows the same shape in
`apps/api/src/lib/mailer.ts`, rendered in the recipient's stored language.

## Authoring the second language

Every admin form that owns content has an "Englische Fassung" block: tips and
combos, subscription plans, Fix Odds packages, promotions, polls and
notification campaigns. Fields left empty simply fall back.

The admin endpoints return the raw `translations` bundle so the editors can
pre-fill; the public serializers deliberately omit it, because a locked tip's
analysis must not be reachable through its translation. An API test asserts
that.

## Adding a third language

1. Add the locale to `SUPPORTED_LOCALES` in `packages/types/src/localization.ts`.
2. Add a catalogue in `packages/ui/src/i18n/` and register it; the parity test
   will tell you what is missing.
3. Add the legal documents in `packages/ui/src/legal.ts`.
4. Add push templates and mail copy.
5. Content follows through the admin forms — no migration, because the
   `translations` column is keyed by locale.

Nothing else changes: the serializers, the locale resolution and the fallback
rules are language-agnostic.

## Verifying it

```bash
pnpm test                       # localisation units, catalogue parity, API behaviour
curl -H 'Accept-Language: en' localhost:4000/api/v1/billing/paywall/combo
curl -H 'Accept-Language: de' localhost:4000/api/v1/billing/paywall/combo
```
