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

const de: Record<LegalSlug, LegalDocument> = {
  terms: {
    slug: 'terms',
    title: 'Allgemeine Geschäftsbedingungen',
    intro: 'Stand: laufende Fassung. Es gilt die zum Zeitpunkt des Vertragsschlusses gültige Version.',
    blocks: [
      { type: 'h2', text: '1. Leistungsgegenstand' },
      {
        type: 'p',
        text: 'PROFIT TIPS stellt redaktionell erstellte Sportanalysen bereit. Eine Analyse enthält Wettmarkt, Auswahl, Quote, Buchmacherangabe und eine schriftliche Begründung. Es handelt sich um Einschätzungen, nicht um Anlage- oder Rechtsberatung und nicht um eine Wettvermittlung.',
      },
      { type: 'h2', text: '2. Konto' },
      {
        type: 'p',
        text: 'Für die Nutzung ist ein Konto erforderlich. Du bist für die Geheimhaltung deiner Zugangsdaten verantwortlich und musst mindestens 18 Jahre alt sein. Ein Konto darf nicht geteilt werden.',
      },
      { type: 'h2', text: '3. Abonnements und Laufzeit' },
      {
        type: 'p',
        text: 'Premium-Produkte (VIP, Combo, Extra, Fix Odds) werden als Abonnement mit fester Laufzeit angeboten. Sofern nicht anders angegeben, verlängert sich ein Abonnement automatisch um die gebuchte Laufzeit, bis es gekündigt wird.',
      },
      {
        type: 'ul',
        items: [
          'Kündigung über Web: jederzeit im Konto unter „Mein Abo“.',
          'Kündigung bei Kauf über den App Store: in den iOS-Einstellungen unter Abonnements.',
          'Kündigung bei Kauf über Google Play: im Play Store unter Abonnements.',
        ],
      },
      { type: 'h2', text: '4. Preise und Zahlung' },
      {
        type: 'p',
        text: 'Es gelten die zum Kaufzeitpunkt angezeigten Preise inklusive gesetzlicher Umsatzsteuer. Die Abrechnung erfolgt über den jeweils gewählten Zahlungsdienstleister.',
      },
      { type: 'h2', text: '5. Widerruf digitaler Inhalte' },
      {
        type: 'p',
        text: 'Bei digitalen Inhalten erlischt das Widerrufsrecht, sobald mit der Ausführung begonnen wurde und du ausdrücklich zugestimmt sowie deine Kenntnis vom Erlöschen bestätigt hast.',
      },
      { type: 'h2', text: '6. Nutzungsrechte' },
      {
        type: 'p',
        text: 'Inhalte sind ausschließlich für den persönlichen Gebrauch bestimmt. Die Weitergabe, Veröffentlichung oder kommerzielle Verwertung von Analysen ist ohne schriftliche Zustimmung untersagt.',
      },
      { type: 'h2', text: '7. Haftung' },
      {
        type: 'p',
        text: 'Wir haften unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit. Im Übrigen ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt. Für Wettentscheidungen und deren finanzielle Folgen haften wir nicht.',
      },
      { type: 'h2', text: '8. Kündigung durch uns' },
      {
        type: 'p',
        text: 'Bei Missbrauch, Weitergabe von Inhalten oder Zahlungsverzug können wir das Konto sperren. Ein bereits bezahlter, ungenutzter Zeitraum wird in diesem Fall anteilig erstattet.',
      },
    ],
  },

  privacy: {
    slug: 'privacy',
    title: 'Datenschutzerklärung',
    blocks: [
      { type: 'h2', text: 'Verarbeitete Daten' },
      {
        type: 'ul',
        items: [
          'Kontodaten: E-Mail-Adresse, Anzeigename, Sprache, Zeitzone, Währung, Land. Rechtsgrundlage: Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).',
          'Zahlungsdaten: Wir speichern keine Kartendaten. Zahlungen werden von Stripe, Apple oder Google abgewickelt; wir speichern lediglich Status, Betrag, Währung und die Vorgangs-ID.',
          'Nutzungsdaten: pseudonyme Produktereignisse (z. B. „paywall_view“) ohne IP-Adresse. Rechtsgrundlage: berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO).',
          'Push-Token: nur, wenn du Benachrichtigungen aktivierst.',
          'Sicherheitsdaten: Sitzungen (IP, User-Agent) zur Missbrauchserkennung.',
        ],
      },
      { type: 'h2', text: 'Speicherdauer' },
      {
        type: 'ul',
        items: [
          'Kontodaten: bis zur Löschung des Kontos.',
          'Rechnungsdaten: gemäß handels- und steuerrechtlicher Aufbewahrungsfristen.',
          'Analysedaten: maximal 180 Tage, danach automatisch gelöscht.',
          'Abgelaufene Sitzungen: automatisch nach 30 Tagen entfernt.',
        ],
      },
      { type: 'h2', text: 'Auftragsverarbeiter' },
      {
        type: 'p',
        text: 'Hosting, E-Mail-Versand, Zahlungsabwicklung (Stripe, Apple, Google) und Push-Zustellung (Expo, Firebase, APNs). Mit allen Dienstleistern bestehen Verträge zur Auftragsverarbeitung.',
      },
      { type: 'h2', text: 'Deine Rechte' },
      {
        type: 'p',
        text: 'Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Die Löschung deines Kontos kannst du jederzeit selbst im Profil auslösen; dabei werden personenbezogene Felder anonymisiert und alle Sitzungen widerrufen.',
      },
      { type: 'h2', text: 'Sicherheit' },
      {
        type: 'p',
        text: 'Passwörter werden ausschließlich als Argon2id-Hash gespeichert. Zugriffstoken sind kurzlebig; Refresh-Token werden rotiert und nur als Hash gespeichert. Anbieter-API-Schlüssel werden mit AES-256-GCM verschlüsselt abgelegt.',
      },
    ],
  },

  'responsible-gambling': {
    slug: 'responsible-gambling',
    title: 'Verantwortungsvolles Spielen',
    intro:
      'PROFIT TIPS veröffentlicht Sportanalysen zu Informations- und Unterhaltungszwecken. Wir sind kein Buchmacher, nehmen keine Wetten an und verwalten keine Kundengelder.',
    blocks: [
      { type: 'h2', text: 'Was wir ausdrücklich nicht versprechen' },
      {
        type: 'ul',
        items: [
          'Keine garantierten Gewinne.',
          'Keine „sicheren“ oder „risikofreien“ Wetten.',
          'Keine Trefferquote von 100 %.',
          'Keine Zusage künftiger Ergebnisse auf Basis vergangener Ergebnisse.',
        ],
      },
      {
        type: 'p',
        text: 'Alle in der App gezeigten Kennzahlen (Trefferquote, ROI, Gewinn, Durchschnittsquote) sind geprüfte historische Ergebnisse bereits abgerechneter Analysen. Sie werden mit einem festen theoretischen Einsatz berechnet und sagen nichts über künftige Ergebnisse aus.',
      },
      { type: 'h2', text: 'Altersgrenze' },
      {
        type: 'p',
        text: 'Die Nutzung ist Personen ab 18 Jahren vorbehalten. In einzelnen Jurisdiktionen gelten höhere Altersgrenzen; es gilt jeweils das Recht deines Wohnsitzlandes.',
      },
      { type: 'h2', text: 'Warnzeichen' },
      {
        type: 'ul',
        items: [
          'Du setzt Geld ein, das du für laufende Kosten benötigst.',
          'Du versuchst, Verluste durch höhere Einsätze auszugleichen.',
          'Du verheimlichst dein Wettverhalten vor Angehörigen.',
          'Wetten bestimmt deine Stimmung oder deinen Tagesablauf.',
        ],
      },
      { type: 'h2', text: 'Hilfe finden' },
      {
        type: 'p',
        text: 'Wenn Glücksspiel keinen Spaß mehr macht, hole dir Unterstützung. In Deutschland berät die Bundeszentrale für gesundheitliche Aufklärung kostenlos und anonym unter 0800 1 37 27 00. In Österreich hilft die Spielsuchthilfe, in der Schweiz „Sucht Schweiz“. Eine Liste von Beratungsstellen findest du auf den Seiten der jeweiligen Behörde.',
      },
      { type: 'h2', text: 'Selbstschutz' },
      {
        type: 'ul',
        items: [
          'Setze dir vorab ein festes Budget und halte dich daran.',
          'Nutze Einzahlungs- und Verlustlimits bei deinem Buchmacher.',
          'Mache regelmäßige Pausen und nutze Selbstsperren, wenn nötig.',
          'Wette nie unter Zeitdruck, Alkohol- oder Substanzeinfluss.',
        ],
      },
    ],
  },

  disclaimer: {
    slug: 'disclaimer',
    title: 'Haftungsausschluss',
    intro:
      'Alle Inhalte dienen ausschließlich Informationszwecken. Sportwetten sind mit finanziellem Risiko verbunden. Der Ausgang eines Sportereignisses lässt sich nicht sicher vorhersagen.',
    blocks: [
      { type: 'h2', text: 'Abgrenzung der Kennzahlen' },
      {
        type: 'ul',
        items: [
          'Analyse / Tipp: eine Einschätzung unseres Redaktionsteams vor dem Ereignis.',
          'Historische Bilanz: Ergebnisse bereits abgerechneter Analysen.',
          'Geprüftes Ergebnis: das über einen Datenanbieter bestätigte Endergebnis des Ereignisses.',
          'Theoretischer ROI: rechnerische Rendite bei einem festen Einsatz je Analyse — kein tatsächlich erzielter Gewinn.',
        ],
      },
      { type: 'h2', text: 'Quoten' },
      {
        type: 'p',
        text: 'Quoten ändern sich laufend. Die zum Zeitpunkt der Veröffentlichung angegebene Quote kann zum Zeitpunkt deiner Wette nicht mehr verfügbar sein. Wir zeigen deshalb sowohl die ursprüngliche als auch die aktuelle Quote an.',
      },
      { type: 'h2', text: 'Keine Aufforderung' },
      {
        type: 'p',
        text: 'Die Veröffentlichung einer Analyse stellt keine Aufforderung zur Abgabe einer Wette dar. Jede Entscheidung triffst du eigenverantwortlich.',
      },
    ],
  },

  help: {
    slug: 'help',
    title: 'Hilfe & Support',
    blocks: [
      { type: 'h2', text: 'Häufige Fragen' },
      { type: 'h3', text: 'Warum sehe ich bei einer Analyse nur Punkte statt der Auswahl?' },
      {
        type: 'p',
        text: 'Die Analyse gehört zu einem Premium-Produkt. Auswahl, Quote und Begründung werden erst nach dem Kauf ausgeliefert — sie verlassen den Server vorher gar nicht.',
      },
      { type: 'h3', text: 'Wie werden die Statistiken berechnet?' },
      {
        type: 'p',
        text: 'Aus abgerechneten Analysen mit einem festen theoretischen Einsatz von einer Einheit. Halbe Gewinne und halbe Verluste (Asian-Handicap-Viertellinien) werden korrekt mit dem halben Einsatz gewertet, annullierte Wetten mit Faktor 1.',
      },
      { type: 'h3', text: 'Mein Kauf wird nicht angezeigt.' },
      {
        type: 'p',
        text: 'Öffne „Mein Abo“ und tippe auf „Wiederherstellen“. Der Server prüft den Kauf erneut direkt bei Stripe, Apple oder Google.',
      },
      { type: 'h3', text: 'Wie kündige ich?' },
      {
        type: 'p',
        text: 'Käufe über die Website kündigst du im Konto. Käufe über den App Store oder Google Play müssen dort gekündigt werden — das schreiben die Plattformbetreiber vor.',
      },
      { type: 'h3', text: 'Wie lösche ich mein Konto?' },
      {
        type: 'p',
        text: 'Im Profil unter „Konto löschen“. Personenbezogene Felder werden anonymisiert und alle Sitzungen sofort widerrufen.',
      },
      { type: 'h2', text: 'Kontakt' },
      {
        type: 'p',
        text: 'Support-Anfragen beantwortet unser Team werktags innerhalb von 24 Stunden. Die Kontaktadresse wird vor dem Produktivstart durch die tatsächliche Support-Adresse des Betreibers ersetzt.',
      },
    ],
  },
};

const en: Record<LegalSlug, LegalDocument> = {
  terms: {
    slug: 'terms',
    title: 'Terms and Conditions',
    intro: 'Current version. The version in force at the time of purchase applies.',
    blocks: [
      { type: 'h2', text: '1. What we provide' },
      {
        type: 'p',
        text: 'PROFIT TIPS publishes editorially produced sports analyses. An analysis contains the betting market, the selection, the odds, the bookmaker and a written rationale. These are opinions — not financial or legal advice, and not bet brokering.',
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
      'PROFIT TIPS publishes sports analyses for information and entertainment. We are not a bookmaker, we do not accept bets and we do not hold customer funds.',
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

export const legalDocuments: Record<SupportedLocale, Record<LegalSlug, LegalDocument>> = { de, en };

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value);
}

export function getLegalDocument(locale: SupportedLocale, slug: LegalSlug): LegalDocument {
  return legalDocuments[locale][slug];
}

/** Footer note reminding the operator to insert their own company details. */
export const LEGAL_FOOTNOTE: Record<SupportedLocale, string> = {
  de: 'Diese Seite dient der Information und ersetzt keine Rechtsberatung. Betreiberangaben, Gerichtsstand und Aufsichtsbehörde sind vor dem Produktivbetrieb durch die tatsächlichen Unternehmensdaten zu ersetzen.',
  en: 'This page is for information and does not replace legal advice. Operator details, jurisdiction and supervisory authority must be replaced with the real company data before going live.',
};
