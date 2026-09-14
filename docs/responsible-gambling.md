# Responsible gambling and compliance

STORM TIPS publishes **sports analyses**, for information and entertainment. It
is not a bookmaker: it accepts no bets, holds no customer funds and brokers no
wagers.

This document records the rules the product follows. They are not decoration —
several are enforced by tests and by the way the statistics are computed.

## What the product must never claim

- No guaranteed profit.
- No "sure", "safe" or "risk-free" bet.
- No 100 % strike rate.
- No promise of future results derived from past results.

`packages/ui/tests/i18n.test.ts` scans both message catalogues for this wording
and fails the build if it appears. The legal documents in
`packages/ui/src/legal.ts` state the same limits explicitly, in German and
English, and are rendered verbatim on the website and in the app.

## Where the numbers come from

Every figure the product displays — strike rate, ROI, yield, return on stake,
average odds, streaks, profit — is recomputed from tips that have **already been
settled** against a verified match result:

- a flat theoretical stake (`STATISTICS_STAKE`, default 10 units) per analysis;
- Asian-handicap quarter lines resolved correctly as half win / half loss;
- voided selections applied with a return factor of 1;
- accumulators settled from their legs, not entered by hand.

No headline number is stored as a literal anywhere in the code. The paywall's
"success rate over the last N days" panel is filled from
`GET /billing/paywall/:product`, which reads the statistics engine.

Every screen that shows these figures also carries the disclaimer that they are
verified historical results of published analyses and say nothing about future
results.

## Age limit

18+ everywhere:

- registration requires an explicit age confirmation and acceptance of the
  terms;
- the legal pages state the limit and note that some jurisdictions set it
  higher;
- the app stores' age ratings must be set to 18+ before submission.

## Advertising and notifications

Marketing categories (`promotions`, `polls`) default to **off**; the customer
opts in. Promotional copy is subject to the same rules as everything else — the
admin console repeats that constraint next to the campaign composer.

Premium push notifications describe the match, never the selection, so a
notification cannot leak paid content to a device without the entitlement.

## Support for people at risk

The responsible-gambling page lists warning signs and self-protection measures
and points to help:

- **Germany** — Bundeszentrale für gesundheitliche Aufklärung, free and
  anonymous, 0800 1 37 27 00.
- **United Kingdom** — GamCare National Gambling Helpline, 0808 8020 133.
- **Austria / Switzerland** — Spielsuchthilfe and Sucht Schweiz.

A link to that page sits on every paywall and in the account area, and the
feed footer repeats the 18+ notice together with the statement that no outcome
is guaranteed.

## Data the operator must supply before launch

The legal documents are complete in substance but deliberately leave the
operator's own details as placeholders. Before going live, replace:

- company name, address, register entry and VAT id;
- the support mailbox;
- jurisdiction and the competent supervisory authority;
- the security contact address in [security.md](security.md).

Every place that needs one is marked in `packages/ui/src/legal.ts` and in the
footnote rendered under each legal page. This documentation is not legal advice;
have the texts reviewed for the markets you operate in.
