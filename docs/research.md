# PROFIT TIPS — Phase 1 Research Log

> This document records the public/open-source research performed **before** implementation,
> the licensing review for every external resource, and how each finding influenced the
> architecture of PROFIT TIPS. No proprietary source code, private repositories, copyrighted
> images or third-party logos were copied. Everything in this repository is an original
> implementation.

Research date: **2026-09-13**

---

## 1. Reference screenshots — UX analysis

Two reference screenshots of an existing commercial tips app were supplied by the product owner.
They were analysed as a *design brief*, not as assets to copy.

### 1.1 Screenshot A — "Free" feed

| Region | Observation | What we reproduce |
| --- | --- | --- |
| Status/header | Centered screen title, left icon (sport switch), right icons (gift/promo, settings) | `AppHeader` with left slot / centered title / right action cluster |
| Promo banner | Full-bleed rounded card, neon gradient border, newsletter CTA, decorative ball | `PromoBanner` driven by the `Promotion` table (admin configurable), neon gradient border |
| Date strip | Horizontally scrollable weekday strip `Fri Sep 11 … Tue Sep 15`, active day is bold white + underline | `DateStrip` component, ±7 days, sticky, keyboard/gesture scrollable |
| League header | Country flag + `Country : League` + bookmaker wordmark right-aligned in accent red | `LeagueHeader` with `CountryFlag` (emoji/ISO based, no third-party logo files) and `BookmakerTag` |
| Tip card | Rounded ~16px dark card `#1C1F26`-ish on `#0E1014` page, two compact team rows with small round crest, date+kickoff on the left rail, odds in green bold bottom-left, market text in uppercase green, status chip right | `TipCard` = `TipCardTimeRail` + `TeamRow`×2 + `OddsBadge` + `MarketLabel` + `StatusBadge` |
| Bottom tabs | 5 tabs: Free / Combo / Extra / VIP / Poll, icon + label, active tinted | `BottomTabBar` (mobile) and `BottomNav` (web) |

Key measurements inferred (and used as design tokens): page gutter 12–14px, card radius 16px,
card padding 12–14px, row height ~28px, team crest 20px, odds font ~17px/700, market font
~13px/700 uppercase with 0.3px letter-spacing, tab bar height 56px + safe area.

### 1.2 Screenshot B — "Combo" paywall

| Region | Observation | What we reproduce |
| --- | --- | --- |
| Title block | Two crown/ticket emoji-style glyphs, then a 2-line value proposition | `PaywallHero` (icons are original SVG, not copied) |
| Stats panel | Dark panel titled "Success Rate for the Last N days" with three label→value rows, values rendered inside **yellow circles** of *varying diameter* (bigger circle = headline metric) | `StatCirclePanel` + `StatCircle` (size prop `sm|md|lg`), N is computed from real data, not hardcoded |
| Plan row | Three equal-width plan cards (1 / 3 / 6 months), price large, a yellow "per month" ribbon under discounted plans | `PlanCard` + `PerMonthRibbon`, all values from `SubscriptionPlan` rows |
| Bundle | Full-width **yellow** card, "Most Popular" pink badge pinned to the top-right, savings line, product glyph row, price on the right | `BundleCard` with `PromoBadge` variants (`MOST_POPULAR`, `SALE`, `LIMITED`, `NEW`) |
| Legal | Terms & Conditions / Privacy policy underlined links at the bottom | `LegalLinks`, plus a Responsible Gambling link we add for compliance |

The three headline metrics in the screenshot (1150 successful analyses / 5025% return / 3.20 average
odds) are **computed** in our implementation by `@profit-tips/statistics` from settled tips, and are
cached in Redis. They are never hardcoded, and are labelled as *historical, verified* results.

---

## 2. Open-source projects and repositories reviewed

| Resource | License | Why it was useful | What we did |
| --- | --- | --- | --- |
| [hyochan/react-native-iap](https://github.com/hyochan/react-native-iap) | MIT | Canonical RN IAP module; v14+ uses StoreKit 2 + Play Billing 8/9 and conforms to the OpenIAP spec. Documents the shape of the purchase payload that must be sent to a server for verification (`transactionId`, `purchaseToken`, JWS representation). | Used as the *client* dependency in `apps/mobile`; our server-side verifier (`packages/payments`) was written from the Apple/Google official docs, not from this repo. |
| [jeonghwanko/onesub](https://github.com/jeonghwanko/onesub) | MIT | Reference for the *shape* of server-side receipt validation: Apple JWS verification against Apple Root CA G3 with the full `x5c` chain, and Google OAuth2 service-account access to Play Developer API v3. | Confirmed our verification flow (decode JWS header → build x5c chain → verify against Apple root → then call App Store Server API for authoritative status). Implemented independently on top of `@apple/app-store-server-library` and `googleapis`. |
| [odds-api/odds-api](https://github.com/odds-api/odds-api) | MIT (OpenAPI spec + examples) | Public OpenAPI description of a modern odds feed: sports → events → bookmakers → markets → outcomes, plus `commence_time`, `last_update`. | Shaped the normalised DTOs in `packages/sports` (`ProviderEvent`, `ProviderOdds`, `ProviderResult`) so that any provider can be mapped onto them. |
| [openbookie/sportbook](https://github.com/openbookie/sportbook) | MIT | Long-lived Rails prediction-pool app; useful for its domain vocabulary (event / market / selection / settlement) and for how it stores *rounds*. | Vocabulary only. |
| [ThalKod/Sport_King](https://github.com/ThalKod/Sport_King), [addtek/reactnative_sports_betting_app](https://github.com/addtek/reactnative_sports_betting_app) | MIT | RN betting UI references — bottom tab structure, match row density, odds button treatment. | Inspiration for information density; all components written from scratch with our own design tokens. |
| [taskforcesh/bullmq](https://github.com/taskforcesh/bullmq) | MIT | Official docs for repeatable jobs, job idempotency via `jobId`, and worker concurrency. | Used directly as our queue library; `jobId` de-duplication is what makes `sync:results` idempotent. |
| [fastify/fastify](https://github.com/fastify/fastify) + first-party plugins | MIT | `@fastify/jwt`, `@fastify/rate-limit`, `@fastify/helmet`, `@fastify/cors`, `@fastify/websocket`, `@fastify/swagger`. | Direct dependencies; chosen over Express for built-in schema validation + serialization speed. |
| [colinhacks/zod](https://github.com/colinhacks/zod) | MIT | v4 API for schema-first validation; `z.toJSONSchema()` removes the need for a separate converter. | Every route body/query/params is a Zod schema; the same schemas are re-exported to web/mobile from `@profit-tips/types`. |
| [prisma/prisma](https://github.com/prisma/prisma) | Apache-2.0 | ORM, migrations, generated types. Best-practice guide: model plans/prices/subscriptions as real tables, keep provider status strings as-is. | Adopted verbatim as a modelling rule — see `SubscriptionStatus` + `providerStatus` raw column. |
| [expo/expo](https://github.com/expo/expo) | MIT | `expo-router` file-based routing, `expo-notifications` (push token + channels + deep-link handling from a notification response). | Mobile app structure. |
| [recharts/recharts](https://github.com/recharts/recharts) | MIT | Charting for the admin/statistics dashboards. | Direct dependency in web + admin. |
| [pinojs/pino](https://github.com/pinojs/pino) | MIT | Structured logging with redaction of `authorization`/`cookie`/`password` fields. | Direct dependency; redaction list configured in `apps/api/src/lib/logger.ts`. |

### Licensing conclusion
Every library we depend on is MIT / Apache-2.0 / BSD — all permissive and compatible with a
commercial closed-source product. Dependencies are consumed through the package manager
(never vendored). No GPL/AGPL dependency is used. No third-party logo, crest, bookmaker mark or
screenshot asset is committed to this repository; bookmaker and team marks are rendered as
text/initials or as operator-supplied URLs stored in the database.

---

## 3. Official documentation consulted

### 3.1 Payments
- **Stripe Billing / Checkout** — subscription lifecycle events
  (`checkout.session.completed`, `customer.subscription.created|updated|deleted`,
  `invoice.paid`, `invoice.payment_failed`), signature verification with
  `stripe.webhooks.constructEvent`, and the rule that **entitlement must be granted from the
  verified webhook, never from the client redirect**.
  → `packages/payments/src/stripe`, `apps/api/src/routes/webhooks/stripe.ts`.
- **Apple App Store Server API v1 + App Store Server Notifications V2** —
  `signedTransactionInfo` / `signedRenewalInfo` JWS payloads, `notificationType` ×
  `subtype` matrix (`SUBSCRIBED`, `DID_RENEW`, `DID_CHANGE_RENEWAL_STATUS`,
  `EXPIRED`, `GRACE_PERIOD_EXPIRED`, `REFUND`), and `originalTransactionId` as the
  stable subscription identity.
  → `packages/payments/src/apple`.
- **Google Play Developer API v3 (`purchases.subscriptionsv2.get`)** and
  **Real-Time Developer Notifications** over Pub/Sub —
  `subscriptionState` (`SUBSCRIPTION_STATE_ACTIVE`, `…_IN_GRACE_PERIOD`,
  `…_CANCELED`, `…_EXPIRED`), `linkedPurchaseToken` for upgrade/downgrade chains,
  and the requirement to acknowledge a purchase within 3 days.
  → `packages/payments/src/google`.

**Takeaway that drove the design:** all three providers converge on the same server-side
model — *(provider, providerSubscriptionId) → status + currentPeriodEnd + autoRenew*.
So `Subscription` is provider-agnostic and every provider adapter returns the same
`NormalizedSubscription`. Entitlements (`VIP`, `COMBO`, `EXTRA`, `FIX_ODDS`) are derived
from subscriptions in one place: `EntitlementService`.

### 3.2 Betting market settlement
Settlement rules were taken from public betting-education material and encoded as pure,
unit-tested functions in `packages/statistics/src/settlement`:

- **1X2 / Double chance / BTTS / Over-Under (half lines)** — binary win/lose, no push.
- **Whole-number totals and handicaps** (2.0, -1.0) — exact hit = `VOID` (push).
- **Quarter lines** (±0.25, ±0.75, 2.25 …) — stake splits 50/50 over the two adjacent
  lines, producing `HALF_WON` (win + push) and `HALF_LOST` (loss + push).
  Profit maths: `HALF_WON → stake/2 × (odds − 1)`, `HALF_LOST → −stake/2`.
- **Alternative goal lines** such as "UNDER 4.0, 4.5" seen in the screenshot are modelled
  as a *split line* `4.25` and settled by the same quarter-line engine.

Sources: public Asian-handicap explainers (SoccerNews, Betshoot, AsianHandicapGuide) — text
descriptions only; the truth table and code are ours, and are covered by 60+ unit tests.

### 3.3 Sports data providers
Compared **SportsGameOdds**, **The Odds API**, **API-Football** and **Goalserve**.

| | SportsGameOdds | The Odds API | API-Football |
| --- | --- | --- | --- |
| Billing model | flat per-event | per-request credits | per-request quota |
| Live scores + settlement | yes | limited | yes (football only) |
| WebSocket streaming | yes | yes | no |
| Free tier | yes | trial | yes |

**Decision:** do not marry the product to one vendor. `packages/sports` defines
`SportsDataProvider` and ships **three** implementations —
`SportsGameOddsProvider` (primary), `TheOddsApiProvider`, and `MockProvider`
(deterministic, used by seeds/tests/offline dev). A DB-backed `ApiProvider` row
(credentials encrypted at rest with AES-256-GCM) selects which one is active,
with per-provider polling interval + rate limit.

### 3.4 Push notifications
- **Expo Push API** — `POST https://exp.host/--/api/v2/push/send`, max **100 messages per
  request**, receipts must be fetched afterwards from `/push/getReceipts`, and
  `DeviceNotRegistered` receipts must delete the token.
  → Implemented exactly this way, including receipt polling as a separate BullMQ job.
- **FCM HTTP v1** and **APNs token-based auth (p8)** are wired as alternative transports for
  bare/production builds.

---

## 4. Packages selected (and why)

| Package | Version | Why |
| --- | --- | --- |
| `fastify` 5 + first-party plugins | 5.x | Schema-first, fastest Node HTTP framework, built-in serializer, mature plugin ecosystem. |
| `@prisma/client` / `prisma` | 7.x | Type-safe queries, first-class migrations, good Postgres index/`@@index` support. |
| `zod` | 4.x | One schema → validation + TS types + OpenAPI JSON Schema. |
| `bullmq` + `ioredis` | 6.x | Reliable Redis queues with repeatable (cron) jobs and per-job idempotency keys. |
| `argon2` | 0.45 | OWASP-recommended password KDF (memory-hard); `bcryptjs` kept only as a verify-only fallback for legacy hashes. |
| `stripe` | 22.x | Official SDK incl. webhook signature verification. |
| `@apple/app-store-server-library` | 3.x | Apple's own library for verifying signed transactions/notifications. |
| `googleapis` | 180.x | Official Play Developer API client. |
| `next` 16 + `react` 19 | latest | App Router, RSC, streaming, great Lighthouse scores for the marketing/web app. |
| `tailwindcss` 4 | 4.x | Token-driven styling that mirrors our design system 1:1. |
| `recharts` | 3.x | Declarative charts for statistics + admin. |
| `expo` 57 / `react-native` 0.87 | latest | Managed workflow, OTA updates, `expo-router` deep links for push navigation. |
| `vitest` | 5.x | Fast unit + integration testing, native TS/ESM. |
| `pino` | 10.x | Structured JSON logs with redaction. |

---

## 5. What was implemented as a result of this research

1. **Provider-agnostic sports layer** (`SportsDataProvider` + 3 adapters + DB-driven selection).
2. **Provider-agnostic billing layer** (Stripe / Apple / Google → one `NormalizedSubscription`).
3. **Webhook idempotency table** (`WebhookEvent`, unique on `(provider, eventId)`) — every
   webhook is recorded *before* processing, so retries can never double-apply.
4. **Entitlement service** as the single source of truth for premium access, evaluated
   server-side on every premium request; the client never decides.
5. **Settlement engine** with a full quarter-line truth table and profit maths, 100% unit tested.
6. **Statistics engine** computing win rate / ROI / yield / streaks / per-league / per-market
   breakdowns from settled tips only, cached in Redis and surfaced on the Combo paywall.
7. **Expo push pipeline** with 100-message chunking and receipt handling (token cleanup).
8. **Responsible-gambling guardrails** — the copy layer forbids "guaranteed profit" style claims,
   every statistic is labelled *historical / theoretical*, and 18+ notices are shown on every
   premium surface.

---

## 6. Explicitly **not** done

- No proprietary code, private repository content, bookmaker logo, team crest, or screenshot
  asset was copied into this repository.
- No scraping of a commercial operator's private API.
- No claim of guaranteed profit anywhere in the product copy (see `docs/responsible-gambling.md`).

---

## 7. Source list

Screens/UX brief: the two reference screenshots supplied by the product owner.

- https://github.com/hyochan/react-native-iap
- https://github.com/jeonghwanko/onesub
- https://github.com/odds-api/odds-api
- https://github.com/openbookie/sportbook
- https://github.com/ThalKod/Sport_King
- https://github.com/addtek/reactnative_sports_betting_app
- https://www.prisma.io/docs/orm/v7/more/best-practices
- https://docs.expo.dev/versions/latest/sdk/notifications/
- https://docs.expo.dev/guides/in-app-purchases/
- https://developer.sportradar.com/odds/reference/intro
- https://sportsgameodds.com/
- https://www.soccernews.com/asian-handicap-betting/401985/
- https://www.betshoot.com/betting-guides/asian-handicap-betting/
- https://asianhandicapguide.com/quarter_goal_asian_handicap.php
- https://apiscout.dev/guides/stripe-webhooks-complete-guide-2026
