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

Copy lives in `packages/notifications/src/templates.ts` in German and English.
Callers pass a template key and its values rather than a finished string, and
the fan-out renders the copy once per recipient language, grouping devices
accordingly — so two users of the same broadcast receive it in their own
languages. Operator-composed campaigns pass `title`/`body` plus optional
`translations` instead. See [localization.md](localization.md).

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

| Transport                  | Used for                                       | Credentials                                                                            |
| -------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| Expo (`ExpoPushTransport`) | Default for the Expo app on both platforms     | `EXPO_ACCESS_TOKEN` (optional, raises throughput)                                      |
| FCM (`FcmPushTransport`)   | Direct Android delivery (HTTP v1)              | `FCM_SERVICE_ACCOUNT_JSON_BASE64`, `FCM_PROJECT_ID`                                    |
| APNs (`ApnsPushTransport`) | Direct iOS delivery (token-based auth)         | `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID`, `APNS_PRODUCTION` |
| SMTP                       | Verification, password reset, billing receipts | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`     |

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
receiving another account's notifications.

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
