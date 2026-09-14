import type { NotificationType } from '@storm-tips/types';

interface Template {
  title: string;
  body: string;
  deepLink: string;
}

/**
 * Template keys are notification types plus a few composed messages that do not
 * map one-to-one onto a stored type — a settlement summary covers many tips but
 * is still recorded as `TIP_RESULT`.
 */
export type TemplateKey = NotificationType | 'TIP_RESULT_SUMMARY' | 'NEW_TIP_MATCH';

type Catalogue = Partial<Record<TemplateKey, Template>>;

/**
 * Push copy, per locale.
 *
 * Deliberately free of profit promises — see docs/responsible-gambling.md.
 * `{placeholders}` are substituted from the caller's values.
 */
const DE: Catalogue = {
  NEW_TIP: {
    title: 'Neue Analyse',
    body: '{league}: {match} — {market}',
    deepLink: 'stormtips://tips/{tipId}',
  },
  NEW_VIP_TIP: {
    title: 'Neue VIP-Analyse',
    body: '{league}: {match} — jetzt ansehen',
    deepLink: 'stormtips://vip/{tipId}',
  },
  NEW_COMBO: {
    title: 'Neue Combo verfügbar',
    body: '{count} Auswahlen · Gesamtquote {odds}',
    deepLink: 'stormtips://combo/{comboId}',
  },
  NEW_EXTRA: {
    title: 'Neue Extra-Auswahl',
    body: '{league}: {match} — {market}',
    deepLink: 'stormtips://extra/{tipId}',
  },
  NEW_FIX_ODDS: {
    title: 'Neue Fix-Odds-Auswahl',
    body: '{plan}: Zielquote {odds}',
    deepLink: 'stormtips://fix-odds/{tipId}',
  },
  TIP_RESULT: {
    title: 'Ergebnis: {outcome}',
    body: '{match} — {market} @ {odds}',
    deepLink: 'stormtips://tips/{tipId}',
  },
  KICKOFF_REMINDER: {
    title: 'Anstoß in {minutes} Minuten',
    body: '{match} — {market}',
    deepLink: 'stormtips://tips/{tipId}',
  },
  SUBSCRIPTION_EXPIRING: {
    title: 'Dein Abo läuft bald ab',
    body: 'Noch {days} Tage Zugriff auf {product}.',
    deepLink: 'stormtips://subscription',
  },
  SUBSCRIPTION_RENEWED: {
    title: 'Abo verlängert',
    body: '{product} ist bis {date} aktiv.',
    deepLink: 'stormtips://subscription',
  },
  SUBSCRIPTION_CANCELED: {
    title: 'Abo gekündigt',
    body: 'Dein Zugriff auf {product} endet am {date}.',
    deepLink: 'stormtips://subscription',
  },
  PROMOTION: { title: '{title}', body: '{body}', deepLink: 'stormtips://paywall/{product}' },
  POLL: { title: 'Neue Umfrage', body: '{question}', deepLink: 'stormtips://polls/{pollId}' },
  SYSTEM: { title: '{title}', body: '{body}', deepLink: 'stormtips://home' },
  TIP_RESULT_SUMMARY: {
    title: '{product}: {won} gewonnen, {lost} verloren',
    body: 'Die aktuellen Ergebnisse stehen in deinem Verlauf bereit.',
    deepLink: 'stormtips://history',
  },
  NEW_TIP_MATCH: {
    title: '{league}',
    body: '{match}: {selection}',
    deepLink: 'stormtips://tips/{tipId}',
  },
};

const EN: Catalogue = {
  NEW_TIP: {
    title: 'New analysis',
    body: '{league}: {match} — {market}',
    deepLink: 'stormtips://tips/{tipId}',
  },
  NEW_VIP_TIP: {
    title: 'New VIP analysis',
    body: '{league}: {match} — open now',
    deepLink: 'stormtips://vip/{tipId}',
  },
  NEW_COMBO: {
    title: 'New combo available',
    body: '{count} selections · total odds {odds}',
    deepLink: 'stormtips://combo/{comboId}',
  },
  NEW_EXTRA: {
    title: 'New Extra selection',
    body: '{league}: {match} — {market}',
    deepLink: 'stormtips://extra/{tipId}',
  },
  NEW_FIX_ODDS: {
    title: 'New Fix Odds selection',
    body: '{plan}: target odds {odds}',
    deepLink: 'stormtips://fix-odds/{tipId}',
  },
  TIP_RESULT: {
    title: 'Result: {outcome}',
    body: '{match} — {market} @ {odds}',
    deepLink: 'stormtips://tips/{tipId}',
  },
  KICKOFF_REMINDER: {
    title: 'Kick-off in {minutes} minutes',
    body: '{match} — {market}',
    deepLink: 'stormtips://tips/{tipId}',
  },
  SUBSCRIPTION_EXPIRING: {
    title: 'Your subscription expires soon',
    body: '{days} days of {product} access remaining.',
    deepLink: 'stormtips://subscription',
  },
  SUBSCRIPTION_RENEWED: {
    title: 'Subscription renewed',
    body: '{product} is active until {date}.',
    deepLink: 'stormtips://subscription',
  },
  SUBSCRIPTION_CANCELED: {
    title: 'Subscription cancelled',
    body: 'Your {product} access ends on {date}.',
    deepLink: 'stormtips://subscription',
  },
  PROMOTION: { title: '{title}', body: '{body}', deepLink: 'stormtips://paywall/{product}' },
  POLL: { title: 'New poll', body: '{question}', deepLink: 'stormtips://polls/{pollId}' },
  SYSTEM: { title: '{title}', body: '{body}', deepLink: 'stormtips://home' },
  TIP_RESULT_SUMMARY: {
    title: '{product}: {won} won, {lost} lost',
    body: 'The latest results are waiting in your history.',
    deepLink: 'stormtips://history',
  },
  NEW_TIP_MATCH: {
    title: '{league}',
    body: '{match}: {selection}',
    deepLink: 'stormtips://tips/{tipId}',
  },
};

/** Exposed so a parity test can assert both languages define the same keys. */
export const templateCatalogues: Record<string, Catalogue> = { de: DE, en: EN };

const CATALOGUES = templateCatalogues;

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
  );
}

export function renderTemplate(
  type: TemplateKey,
  locale: string,
  values: Record<string, string | number> = {},
): { title: string; body: string; deepLink: string } {
  const catalogue = CATALOGUES[locale.split('-')[0] ?? 'de'] ?? DE;
  const template = catalogue[type] ?? DE[type] ?? EN.SYSTEM!;
  return {
    title: interpolate(template.title, values),
    body: interpolate(template.body, values),
    deepLink: interpolate(template.deepLink, values),
  };
}

/** Maps a notification type onto the user preference flag that gates it. */
export const PREFERENCE_FOR_TYPE: Record<NotificationType, string> = {
  NEW_TIP: 'newTips',
  NEW_VIP_TIP: 'vipTips',
  NEW_COMBO: 'comboTips',
  NEW_EXTRA: 'extraTips',
  NEW_FIX_ODDS: 'fixOddsTips',
  TIP_RESULT: 'results',
  KICKOFF_REMINDER: 'kickoffReminders',
  SUBSCRIPTION_EXPIRING: 'subscription',
  SUBSCRIPTION_RENEWED: 'subscription',
  SUBSCRIPTION_CANCELED: 'subscription',
  PROMOTION: 'promotions',
  POLL: 'polls',
  SYSTEM: 'subscription',
};

/** Android notification channels created by the mobile app. */
export const ANDROID_CHANNELS = {
  tips: 'tips',
  results: 'results',
  reminders: 'reminders',
  account: 'account',
  promotions: 'promotions',
} as const;

export function channelForType(type: NotificationType): string {
  switch (type) {
    case 'TIP_RESULT':
      return ANDROID_CHANNELS.results;
    case 'KICKOFF_REMINDER':
      return ANDROID_CHANNELS.reminders;
    case 'SUBSCRIPTION_EXPIRING':
    case 'SUBSCRIPTION_RENEWED':
    case 'SUBSCRIPTION_CANCELED':
      return ANDROID_CHANNELS.account;
    case 'PROMOTION':
      return ANDROID_CHANNELS.promotions;
    default:
      return ANDROID_CHANNELS.tips;
  }
}
