# Notifications

Two channels: push (mobile) and transactional email. Both are produced by
`@storm-tips/notifications` and delivered by the worker, so nothing blocks an
HTTP request.

```
event ──► notification:fanout ──► one Notification row per eligible user
                                  └─► notification:send ──► Expo / FCM / APNs / SMTP
```

## Types

| Type                                                                     | Trigger                                         |
| ------------------------------------------------------------------------ | ----------------------------------------------- |
| `NEW_TIP`                                                                | A free tip is published                         |
| `NEW_VIP_TIP`, `NEW_EXTRA`, `NEW_COMBO`, `NEW_FIX_ODDS`                  | A premium tip or combo is published             |
| `TIP_RESULT`                                                             | A tip is settled                                |
| `KICKOFF_REMINDER`                                                       | Shortly before an event with an open tip starts |
| `SUBSCRIPTION_EXPIRING`, `SUBSCRIPTION_RENEWED`, `SUBSCRIPTION_CANCELED` | Billing lifecycle                               |
| `PROMOTION`                                                              | Admin-scheduled campaign                        |
| `POLL`                                                                   | A new poll opens                                |
| `SYSTEM`                                                                 | Operational message                             |

Copy lives in `packages/notifications/src/templates.ts`. Callers pass a
template key and its values rather than a finished string, so the wording stays
in one place and a compliance test can scan it. Operator-composed campaigns
pass `title`/`body` directly instead.

## Who receives what

Fan-out filters on three things, in this order:

1. **Entitlement** — a premium notification is only sent to users who can
   actually open the content. The same `EntitlementService` decides this, so a
   push never leaks a selection to someone without access. Titles and bodies for
   premium tips deliberately describe the match, not the pick.
2. **Preference** — `User.notificationPrefs` (`newTips`, `vipTips`, `comboTips`,
   `extraTips`, `fixOddsTips`, `results`, `kickoffReminders`, `subscription`,
   `promotions`, `polls`). Marketing categories default to off.
3. **Device** — only `DeviceToken` rows still marked active.

## Transports

| Transport                     | Used for                                       | Credentials                                                                            |
| ----------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| Expo (`ExpoPushTransport`)    | Default for the Expo app on both platforms     | `EXPO_ACCESS_TOKEN` (optional, raises throughput)                                      |
| FCM (`FcmPushTransport`)      | Direct Android delivery (HTTP v1)              | `FCM_SERVICE_ACCOUNT_JSON_BASE64`, `FCM_PROJECT_ID`                                    |
| APNs (`ApnsPushTransport`)    | Direct iOS delivery (token-based auth)         | `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID`, `APNS_PRODUCTION` |
| Web Push (`WebPushTransport`) | Browsers, including the installed PWA          | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`                               |
| SMTP                          | Verification, password reset, billing receipts | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`     |

Without credentials a transport reports that it is not configured; notifications
are still stored and visible in the in-app inbox, but nothing is delivered and
nothing pretends it was. Mailpit (`--profile dev` in the compose file) catches
mail locally at http://localhost:8025.

## Receipts and dead tokens

`notification:receipts` runs every 10 minutes and reads Expo's receipt endpoint.
A `DeviceNotRegistered` receipt deactivates that token, which is what keeps the
device table from accumulating uninstalled apps.

## Device registration

The app registers after sign-in and after the user enables a category:

```http
POST /api/v1/me/devices
{ "token": "ExponentPushToken[…]", "provider": "EXPO", "platform": "IOS",
  "deviceName": "iPhone", "appVersion": "1.0.0" }
```

Logging out calls `DELETE /me/devices/:token`, so a shared device stops
receiving another account's notifications. A browser's token is a JSON object
rather than a string and cannot travel in a path segment, so it is turned off
with `POST /me/devices/deactivate` and the token in the body instead.

## Favourites

A reader can mark leagues in Favourites and turn on "only my favourite leagues
and teams" in notification settings. New-analysis notifications then carry what
they are about (`audience.about`: the league and both teams), and a reader with
that setting is left out of anything they did not mark.

Two deliberate limits: a notification with no `about` — a subscription
reminder, a promotion — never filters anyone, because it is about their account
rather than a match; and the setting is inert until something is actually
marked, since "only my favourites" with no favourites would mean silence, which
is never what anyone meant by it.

Favourites never change the feed. Everything published stays in it; this only
decides what is worth interrupting someone for.

## Browsers

`GET /api/v1/push/config` returns `{ enabled, publicKey }`. The public half of
the VAPID pair is meant to be public — it is what the browser encrypts to, and
it is useless without the private half, which never leaves the server. When no
pair is configured `enabled` is false and the web app hides the toggle rather
than offering something that cannot work.

Generate a pair once, per environment:

```bash
npx web-push generate-vapid-keys
```

The browser subscribes only from a click in Notifications settings: a page that
asks on load is refused by the reader and often by the browser, and a refusal
sticks until they change it in the site settings themselves.

The subscription is stored as a device token like any other (`provider:
WEB_PUSH`, `platform: WEB`), so the same fan-out, the same per-type preferences
and the same dead-token cleanup apply. A `404` or `410` from the push endpoint
is the browser saying the subscription is gone, and deactivates it.

`apps/web/public/sw.js` handles delivery. It caches nothing — a feed served
from yesterday's cache is worse than an error, because a price that has moved
reads exactly like one that has not — and it tells open tabs about each push so
the page behind the notification refetches instead of going stale.

Android channels (`tips`, `results`, `reminders`, `account`, `promotions`) are
created before the first notification so each category can be silenced
individually in the system settings.

## Deep links

Every notification may carry a `deepLink` such as `stormtips://tips/<id>` or
`stormtips://paywall/combo`. The app maps it to a route on open, including when
the notification cold-starts the process.

## Scheduling

`notification:scheduled` runs every minute and releases notifications whose
`scheduledFor` has passed — that is how admin campaigns and kickoff reminders
are timed without a separate scheduler.
