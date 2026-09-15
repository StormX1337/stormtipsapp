# Mobile app

Expo SDK 54, React Native 0.81, expo-router 6, TypeScript. One codebase for iOS
and Android; the web target exists only as a development convenience — the
public website is `apps/web`.

## Running it

```bash
pnpm install
pnpm dev:api            # the app needs the API
pnpm dev:mobile         # Expo dev server
```

`apps/mobile/.env` holds the public runtime configuration:

```bash
EXPO_PUBLIC_API_URL=http://localhost:4000
EXPO_PUBLIC_WS_URL=ws://localhost:4000/ws
EXPO_PUBLIC_APP_NAME="STORM TIPS"
```

`EXPO_PUBLIC_*` values are compiled into the bundle. Never put a secret there.

On a physical device replace `localhost` with your machine's LAN address and add
that origin to `CORS_ORIGINS`.

### Expo Go vs. a development build

Expo Go runs everything except in-app purchases: `react-native-iap` is a native
module and is not part of the Go client. The paywall detects this and shows a
message saying a development or production build is required, rather than
failing silently. Build one with:

```bash
npx eas build --profile development --platform ios
npx eas build --profile development --platform android
```

## Screens

| Route                                        | Screen                                                        |
| -------------------------------------------- | ------------------------------------------------------------- |
| `(tabs)/free`, `/vip`, `/extra`              | Product feeds with the date strip and promo banner            |
| `(tabs)/combo`                               | Combos when subscribed, the paywall when not                  |
| `(tabs)/poll`                                | Polls with live results                                       |
| `tips/[id]`                                  | Tip detail: selection, odds, confidence, analysis, result     |
| `paywall/[product]`                          | Full paywall (statistics, plans, bundle, benefits, legal)     |
| `statistics`                                 | Win rate, ROI, profit, streaks, league and market breakdowns  |
| `live`, `history`                            | In-play tips; the verified results archive                    |
| `auth/login`, `auth/register`, `auth/forgot` | Account access                                                |
| `account/*`                                  | Profile, subscription, notifications, referrals               |
| `legal/[slug]`                               | Terms, privacy, responsible gambling, disclaimer, help        |
| `onboarding`                                 | Three slides, shown once; asks for push permission at the end |

## Architecture notes

- **`src/lib/api.ts`** — typed client with a request timeout, one transparent
  refresh-token rotation on a 401, and a reachability signal that drives both the
  offline banner and React Query's online state.
- **`src/lib/storage.ts`** — tokens go to the Keychain / Keystore through
  `expo-secure-store`; feed caches and preferences go to AsyncStorage. A token
  is never written to AsyncStorage.
- **`src/lib/auth.tsx`** — restores the session before the first screen paints,
  exposes `has(product)` derived from the server's entitlement list. That flag
  drives navigation only; the premium fields themselves are already absent from
  a locked tip.
- **`src/lib/purchases.ts`** — lazily imports `react-native-iap`, sends the
  signed transaction to `POST /billing/purchases/verify`, and finishes the store
  transaction only after the server confirms.
- **Offline** — the last feed for each product and date is cached and shown with
  an offline banner when the API cannot be reached.
- **No bundled artwork** — crests are coloured monograms, icons are drawn with
  `react-native-svg` from the shared design tokens.

## Design system

`packages/ui` is the single source of colours, spacing, radii and type scale for
web and native, so the two stay in visual lockstep. `src/lib/theme.ts` re-exports
those tokens as React Native styles.

## Building for iOS

An iOS binary can only be produced by Apple's toolchain, so there are two routes
and neither runs on this machine:

- **EAS Build** — Expo's hosted macOS builders. Works from Linux or Windows, and
  is the route this project is set up for.
- **Xcode on a Mac** — `npx expo prebuild -p ios`, then open
  `ios/stormtips.xcworkspace`. Only worth it if you already have the Mac.

Either way you need a paid **Apple Developer Program** membership for TestFlight
or the App Store. Without one you can still run the app on your own device
through a development build, but you cannot distribute it.

### First time

```bash
cd apps/mobile
npx eas login                 # your Expo account
npx eas init                  # writes the real extra.eas.projectId into app.json
```

`extra.eas.projectId` ships as an all-zero placeholder; `eas init` replaces it.
A build against the placeholder fails immediately.

### The builds

```bash
# On your own iPhone, with the dev server — includes native modules Expo Go lacks.
npx eas build --profile development --platform ios

# A TestFlight-ready build.
npx eas build --profile production --platform ios
npx eas submit --profile production --platform ios
```

EAS asks for your Apple ID on the first production build and manages the
signing certificate and provisioning profile for you. The profiles in
`eas.json` decide which API the binary talks to — check `EXPO_PUBLIC_API_URL`
there before a production build, because it is compiled in and cannot be
changed afterwards.

### Before the first submission

- **App icon** — `assets/icon.png` is a plain placeholder mark in the product's
  own colours. Replace it with real artwork before release; it must stay
  1024×1024 and must not carry an alpha channel, which Apple rejects.
- **In-app purchases** — payments on iOS go through `react-native-iap`, not
  Stripe, and Apple requires that. Create each subscription in App Store
  Connect and put its product id on the matching plan
  (Admin → Plans → Apple product id). A plan with an empty `appleProductId`
  cannot be bought in the app; the seed ships them all empty.
- **Push** — `UIBackgroundModes: remote-notification` is already declared. Upload
  an APNs key and set `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` on the
  server.
- Bump `expo.version` for a new public version; the build number is handled by
  `autoIncrement` in the production profile.

## Building for Android

```bash
npx eas build --profile production --platform android
npx eas submit --profile production --platform android
```

Same profiles, and the same requirement that every plan carries its
`googleProductId`.

### Store review checklist

- The app is 18+; set the age rating accordingly in both stores and keep the
  age gate on the registration screen.
- Declare the subscription products and prices, and link the terms and privacy
  URLs served by the website.
- Apple requires restore-purchases; it is on the paywall and in
  Account → Subscription.
- Gambling-adjacent content: both stores expect the app to make no promise of
  winnings. The copy states that figures are verified historical results and
  that no outcome is guaranteed — do not change that wording to something
  stronger.

## Why the workspace uses a hoisted node_modules

Metro resolves modules by walking `node_modules` upwards and does not understand
pnpm's isolated symlink layout, so `.npmrc` sets `node-linker=hoisted`. Two
related workarounds live in `metro.config.js`: workspace packages import
siblings with an explicit `.js` extension (Node ESM), which is rewritten to the
TypeScript source, and `merge-options` is pinned to its CommonJS entry because
AsyncStorage's web build reads `.default` off it.

## Verifying a change

```bash
pnpm --filter @storm-tips/mobile typecheck
cd apps/mobile && npx expo export --platform android --output-dir .expo-export
```

The export is what CI runs: it proves the app still bundles for a device, which
typechecking alone does not catch.
