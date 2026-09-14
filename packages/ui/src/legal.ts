import type { SupportedLocale } from './types.js';

/**
 * Legal and support documents.
 *
 * Kept as structured data rather than markup so the web app, the admin app and
 * the native app all render exactly the same wording from one source, in both
 * supported languages.
 *
 * The texts deliberately avoid any promise of profit: they state that the
 * figures shown in the product are verified historical results of settled
 * analyses and that no outcome is guaranteed.
 *
 * Operator details (company, address, jurisdiction, supervisory authority and
 * the support mailbox) must be filled in by the operator before going live —
 * every place that needs one is marked in the text.
 */
export type LegalSlug = 'terms' | 'privacy' | 'responsible-gambling' | 'disclaimer' | 'help';

export const LEGAL_SLUGS: readonly LegalSlug[] = [
  'terms',
  'privacy',
  'responsible-gambling',
  'disclaimer',
  'help',
];

export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] };

export interface LegalDocument {
  slug: LegalSlug;
  title: string;
  intro?: string;
  blocks: LegalBlock[];
}

const en: Record<LegalSlug, LegalDocument> = {
  terms: {
    slug: 'terms',
    title: 'Terms and Conditions',
    intro: 'Current version. The version in force at the time of purchase applies.',
    blocks: [
      { type: 'h2', text: '1. What we provide' },
      {
        type: 'p',
        text: 'STORM TIPS publishes editorially produced sports analyses. An analysis contains the betting market, the selection, the odds, the bookmaker and a written rationale. These are opinions — not financial or legal advice, and not bet brokering.',
      },
      { type: 'h2', text: '2. Your account' },
      {
        type: 'p',
        text: 'An account is required. You are responsible for keeping your credentials secret and must be at least 18 years old. Accounts may not be shared.',
      },
      { type: 'h2', text: '3. Subscriptions and term' },
      {
        type: 'p',
        text: 'Premium products (VIP, Combo, Extra, Fix Odds) are sold as fixed-term subscriptions. Unless stated otherwise, a subscription renews automatically for the same term until it is cancelled.',
      },
      {
        type: 'ul',
        items: [
          'Bought on the web: cancel any time under “My subscription”.',
          'Bought through the App Store: cancel in iOS Settings → Subscriptions.',
          'Bought through Google Play: cancel in the Play Store under Subscriptions.',
        ],
      },
      { type: 'h2', text: '4. Prices and payment' },
      {
        type: 'p',
        text: 'The prices shown at the time of purchase apply, including statutory VAT. Billing is handled by the payment provider you choose.',
      },
      { type: 'h2', text: '5. Right of withdrawal for digital content' },
      {
        type: 'p',
        text: 'For digital content the right of withdrawal expires once performance has begun, you have expressly agreed to this and acknowledged that you thereby lose that right.',
      },
      { type: 'h2', text: '6. Permitted use' },
      {
        type: 'p',
        text: 'Content is for personal use only. Redistributing, publishing or commercially exploiting analyses without written consent is prohibited.',
      },
      { type: 'h2', text: '7. Liability' },
      {
        type: 'p',
        text: 'We are liable without limitation for intent and gross negligence and for injury to life, body or health. Otherwise liability is limited to foreseeable damage typical of this type of contract. We are not liable for betting decisions or their financial consequences.',
      },
      { type: 'h2', text: '8. Termination by us' },
      {
        type: 'p',
        text: 'We may suspend an account in case of abuse, redistribution of content or payment default. Any prepaid, unused period is refunded pro rata.',
      },
    ],
  },

  privacy: {
    slug: 'privacy',
    title: 'Privacy Policy',
    blocks: [
      { type: 'h2', text: 'Data we process' },
      {
        type: 'ul',
        items: [
          'Account data: email address, display name, language, time zone, currency, country. Legal basis: performance of a contract (Art. 6(1)(b) GDPR).',
          'Payment data: we never store card details. Payments are handled by Stripe, Apple or Google; we keep only status, amount, currency and the transaction id.',
          'Usage data: pseudonymous product events (e.g. “paywall_view”) without IP address. Legal basis: legitimate interest (Art. 6(1)(f) GDPR).',
          'Push tokens: only if you enable notifications.',
          'Security data: sessions (IP, user agent) for abuse detection.',
        ],
      },
      { type: 'h2', text: 'Retention' },
      {
        type: 'ul',
        items: [
          'Account data: until the account is deleted.',
          'Invoice data: for the statutory commercial and tax retention periods.',
          'Analytics data: 180 days at most, then deleted automatically.',
          'Expired sessions: removed automatically after 30 days.',
        ],
      },
      { type: 'h2', text: 'Processors' },
      {
        type: 'p',
        text: 'Hosting, email delivery, payment processing (Stripe, Apple, Google) and push delivery (Expo, Firebase, APNs). Data processing agreements are in place with every provider.',
      },
      { type: 'h2', text: 'Your rights' },
      {
        type: 'p',
        text: 'You have the right to access, rectification, erasure, restriction of processing, data portability and objection. You can delete your account yourself in your profile at any time: personal fields are anonymised and every session is revoked.',
      },
      { type: 'h2', text: 'Security' },
      {
        type: 'p',
        text: 'Passwords are stored only as Argon2id hashes. Access tokens are short-lived; refresh tokens are rotated and stored as hashes. Provider API keys are encrypted with AES-256-GCM.',
      },
    ],
  },

  'responsible-gambling': {
    slug: 'responsible-gambling',
    title: 'Responsible Gambling',
    intro:
      'STORM TIPS publishes sports analyses for information and entertainment. We are not a bookmaker, we do not accept bets and we do not hold customer funds.',
    blocks: [
      { type: 'h2', text: 'What we explicitly do not promise' },
      {
        type: 'ul',
        items: [
          'No guaranteed profit.',
          'No “sure” or “risk-free” bets.',
          'No 100 % strike rate.',
          'No promise of future results based on past results.',
        ],
      },
      {
        type: 'p',
        text: 'Every figure shown in the app (strike rate, ROI, profit, average odds) is a verified historical result of already settled analyses. The figures are computed with a fixed theoretical stake and say nothing about future results.',
      },
      { type: 'h2', text: 'Age limit' },
      {
        type: 'p',
        text: 'Use is restricted to people aged 18 and over. Some jurisdictions set a higher limit; the law of your country of residence applies.',
      },
      { type: 'h2', text: 'Warning signs' },
      {
        type: 'ul',
        items: [
          'You stake money you need for living costs.',
          'You try to win back losses with bigger stakes.',
          'You hide your betting from people close to you.',
          'Betting dictates your mood or your daily routine.',
        ],
      },
      { type: 'h2', text: 'Getting help' },
      {
        type: 'p',
        text: 'If gambling stops being fun, get support. In Germany the Federal Centre for Health Education advises free of charge and anonymously on 0800 1 37 27 00. In the UK, GamCare runs the National Gambling Helpline on 0808 8020 133. Your national regulator publishes a list of counselling services.',
      },
      { type: 'h2', text: 'Protecting yourself' },
      {
        type: 'ul',
        items: [
          'Set a fixed budget up front and stick to it.',
          'Use deposit and loss limits at your bookmaker.',
          'Take regular breaks and use self-exclusion when needed.',
          'Never bet under time pressure or under the influence of alcohol or drugs.',
        ],
      },
    ],
  },

  disclaimer: {
    slug: 'disclaimer',
    title: 'Disclaimer',
    intro:
      'All content is for information only. Sports betting carries financial risk. The outcome of a sporting event cannot be predicted with certainty.',
    blocks: [
      { type: 'h2', text: 'What the figures mean' },
      {
        type: 'ul',
        items: [
          'Analysis / tip: our editorial team’s assessment before the event.',
          'Historical record: results of analyses that have already been settled.',
          'Verified result: the final result of the event as confirmed by a data provider.',
          'Theoretical ROI: the arithmetic return at a fixed stake per analysis — not profit actually realised.',
        ],
      },
      { type: 'h2', text: 'Odds' },
      {
        type: 'p',
        text: 'Odds move constantly. The price quoted at publication may no longer be available when you place a bet, which is why we show both the original and the current odds.',
      },
      { type: 'h2', text: 'No solicitation' },
      {
        type: 'p',
        text: 'Publishing an analysis is not an invitation to place a bet. Every decision is yours alone.',
      },
    ],
  },

  help: {
    slug: 'help',
    title: 'Help & Support',
    blocks: [
      { type: 'h2', text: 'Frequently asked questions' },
      { type: 'h3', text: 'Why does an analysis show dots instead of the selection?' },
      {
        type: 'p',
        text: 'That analysis belongs to a premium product. Selection, odds and rationale are delivered only after purchase — they never leave the server before that.',
      },
      { type: 'h3', text: 'How are the statistics calculated?' },
      {
        type: 'p',
        text: 'From settled analyses using a fixed theoretical stake of one unit. Half wins and half losses (Asian handicap quarter lines) count with half the stake, and voided bets with a factor of 1.',
      },
      { type: 'h3', text: 'My purchase is not showing up.' },
      {
        type: 'p',
        text: 'Open “My subscription” and tap “Restore”. The server re-verifies the purchase directly with Stripe, Apple or Google.',
      },
      { type: 'h3', text: 'How do I cancel?' },
      {
        type: 'p',
        text: 'Purchases made on the website are cancelled in your account. Purchases made through the App Store or Google Play must be cancelled there — the platforms require it.',
      },
      { type: 'h3', text: 'How do I delete my account?' },
      {
        type: 'p',
        text: 'In your profile under “Delete account”. Personal fields are anonymised and every session is revoked immediately.',
      },
      { type: 'h2', text: 'Contact' },
      {
        type: 'p',
        text: 'Our team answers support requests within 24 hours on business days. The contact address is replaced with the operator’s real support mailbox before going live.',
      },
    ],
  },
};

export const legalDocuments: Record<SupportedLocale, Record<LegalSlug, LegalDocument>> = { en };

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value);
}

export function getLegalDocument(locale: SupportedLocale, slug: LegalSlug): LegalDocument {
  return legalDocuments[locale][slug];
}

/** Footer note reminding the operator to insert their own company details. */
export const LEGAL_FOOTNOTE: Record<SupportedLocale, string> = {
  en: 'This page is for information and does not replace legal advice. Operator details, jurisdiction and supervisory authority must be replaced with the real company data before going live.',
};
