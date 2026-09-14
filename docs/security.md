# Security

## Principles

1. **The server decides what a user may see.** No client flag, header or body
   field can unlock premium content — the fields simply are not in the response.
2. **Secrets never reach a client.** Only `NEXT_PUBLIC_*` and `EXPO_PUBLIC_*`
   values are compiled into a bundle, and none of them is a credential.
3. **Fail closed.** A missing credential produces a clear error, never a
   fallback that pretends the operation succeeded.
4. **Every privileged change is recorded.** Admin mutations are written to
   `AuditLog` with actor, before and after.

## Authentication

| Control               | Implementation                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Password storage      | Argon2id (`@node-rs/argon2`), 19 MiB / t=2 / p=1, the OWASP baseline. Plaintext is never stored or logged               |
| Rehash on login       | `needsRehash()` upgrades hashes created with weaker parameters                                                          |
| Access tokens         | JWT (`jose`), 15 minutes by default, signed with `JWT_ACCESS_SECRET`                                                    |
| Refresh tokens        | 30 days, rotated on every use, stored only as hashes                                                                    |
| Reuse detection       | Tokens belong to a family; replaying a rotated token revokes the family and returns `TOKEN_REUSED`                      |
| Credential rate limit | `AUTH_RATE_LIMIT_MAX` per window on login, register and reset                                                           |
| Account enumeration   | `POST /auth/forgot-password` always answers 204                                                                         |
| Session management    | `GET /auth/sessions` lists devices; `DELETE /auth/sessions/:familyId` revokes one; changing a password revokes the rest |

## Authorisation

`EntitlementService` is the only authority on premium access. It reads
entitlements and subscriptions, applies the pure rules in
`@storm-tips/payments`, caches the answer in Redis for 60 seconds and
invalidates that cache on every relevant change.

Locked tips are stripped **in the serializer**, before the response is built:
selection, selection key, odds, current odds and analysis become `null`. The
same check gates single tips, combos, the paywall and premium WebSocket topics.

Admin routes require an `ADMIN` (or `EDITOR`) role. The admin app sets
`X-Robots-Tag: noindex, nofollow, noarchive`, and the reverse proxy serves it
from its own hostname so it can be firewalled separately.

## Secrets at rest

Provider API keys stored through the admin console are encrypted with
AES-256-GCM using `ENCRYPTION_KEY` (32 bytes, hex). The plaintext is never
returned by the API — the console displays a masked value
(`sk_l••••••••abcd`). Rotating a key is a database change, not a redeploy.

`.env` is git-ignored; `.env.example` contains placeholders only, and the
compose file refuses to start without real values rather than falling back to a
default secret.

## Transport and HTTP hardening

- `@fastify/helmet`: CSP, `frameAncestors 'none'`, `objectSrc 'none'`,
  `X-Content-Type-Options`, referrer policy, and HSTS with preload in
  production.
- CORS is a strict allowlist (`CORS_ORIGINS`). Requests without an `Origin`
  header (mobile apps, server-to-server) are allowed because CORS is a browser
  protection and those callers authenticate with a bearer token.
- Cookies are `httpOnly`, `sameSite=lax`, and `secure` in production.
- Both Next.js apps set their own security headers, and nginx adds HSTS.

## Rate limiting

Two Redis-backed buckets, so limits hold across API instances: a global one
keyed by user id (falling back to IP, so one NAT cannot exhaust another user's
quota) and the stricter credential bucket. `/health` and `/ready` are exempt.

## Input validation

Every body, query and path parameter is parsed with a Zod schema from
`@storm-tips/types` — the same schemas the clients use, so there is one
definition per shape. A failure returns `VALIDATION_ERROR` (422) listing the
offending fields. Prisma parameterises all SQL; no query is string-built.

## Webhooks

| Provider | Verification                                                                                                    |
| -------- | --------------------------------------------------------------------------------------------------------------- |
| Stripe   | Signature over the raw body with `STRIPE_WEBHOOK_SECRET`                                                        |
| Apple    | JWS signature chain of the App Store Server Notification                                                        |
| Google   | OIDC token on the Pub/Sub push, checked against `GOOGLE_PUBSUB_AUDIENCE` and the expected service-account email |

Each delivery claims its event id in `WebhookEvent` before processing, so a
replay is ignored instead of granting a second period of access.

## Privacy

- Analytics events are pseudonymous and store no IP address.
- `DELETE /me` anonymises personal fields, revokes every session and deactivates
  devices; invoice records are retained for the statutory period.
- Retention: analytics 180 days, expired sessions 30 days, both enforced by the
  `cleanup` job.
- Emails are masked for public display (`maskEmail`) wherever another user could
  see them, such as referral lists.

## Logging

`pino` with redaction: `authorization` headers, passwords, tokens and receipt
bodies never reach the logs. Every request carries an `x-request-id` that is
echoed in the error envelope, so a customer report can be traced without asking
for personal data.

## Dependency and code scanning

- `.github/workflows/codeql.yml` runs CodeQL's security-and-quality queries on
  every push, pull request and weekly.
- `pnpm audit` is the manual check for advisories; keep the lockfile committed
  so CI installs exactly what was reviewed.

## Reporting a vulnerability

Do not open a public issue. Contact the operator's security address (to be
filled in by the operator before launch) with steps to reproduce. Expect an
acknowledgement within two business days.

## Pre-launch checklist

- [ ] Fresh `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`,
      `INTERNAL_API_TOKEN` generated with `openssl rand -hex 32`
- [ ] `SEED_ADMIN_PASSWORD` changed, or the seeded admin removed entirely
- [ ] `CORS_ORIGINS` limited to the real front-end origins
- [ ] TLS terminated, HSTS enabled, HTTP redirected
- [ ] PostgreSQL and Redis unreachable from the public internet
- [ ] Admin console behind an IP allowlist or VPN
- [ ] Webhook secrets configured for every provider actually in use
- [ ] Backups scheduled **and** a restore rehearsed
- [ ] Store-side age rating set to 18+ and the age gate enabled
