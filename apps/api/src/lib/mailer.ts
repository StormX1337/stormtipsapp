import nodemailer, { type Transporter } from 'nodemailer';
import { env } from './env.js';
import { logger } from './logger.js';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    connectionTimeout: 8_000,
  });
  return transporter;
}

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends a transactional email.
 *
 * A mail failure must never break the request that triggered it (a user can
 * always request a new link), so failures are logged and reported, not thrown.
 */
export async function sendMail(input: MailInput): Promise<boolean> {
  try {
    await getTransporter().sendMail({
      from: env.SMTP_FROM,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return true;
  } catch (error) {
    logger.warn(
      { err: error, to: input.to, subject: input.subject },
      'email delivery failed — link is still valid and can be re-requested',
    );
    if (env.NODE_ENV !== 'production') {
      logger.info({ subject: input.subject, body: input.text }, 'email contents (development)');
    }
    return false;
  }
}

function layout(
  title: string,
  body: string,
  ctaLabel: string | undefined,
  ctaUrl: string | undefined,
  footer: string,
  lang = 'de',
): string {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0A0C10;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#fff">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#151821;border-radius:16px;padding:28px">
        <tr><td style="font-size:20px;font-weight:800;letter-spacing:.5px;color:#12E17F;padding-bottom:16px">STORM TIPS</td></tr>
        <tr><td style="font-size:18px;font-weight:700;padding-bottom:12px">${title}</td></tr>
        <tr><td style="font-size:14px;line-height:1.6;color:#9BA5B7">${body}</td></tr>
        ${
          ctaUrl
            ? `<tr><td style="padding-top:24px"><a href="${ctaUrl}" style="display:inline-block;background:#12E17F;color:#0A0C10;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px">${ctaLabel}</a></td></tr>
               <tr><td style="padding-top:16px;font-size:12px;color:#6C7688;word-break:break-all">${ctaUrl}</td></tr>`
            : ''
        }
        <tr><td style="padding-top:28px;font-size:11px;color:#6C7688;line-height:1.6">
          ${footer}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

interface MailCopy {
  footer: string;
  verifySubject: string;
  verifyBody: string;
  verifyCta: string;
  verifyText: (url: string) => string;
  resetSubject: string;
  resetBody: string;
  resetCta: string;
  resetText: (url: string) => string;
  expiringSubject: (product: string, days: number) => string;
  expiringBody: string;
  expiringCta: string;
  expiringText: (product: string, days: number) => string;
}

/** Transactional copy, per locale. Anything unknown falls back to German. */
const MAIL_COPY: Record<'de' | 'en', MailCopy> = {
  de: {
    footer:
      'STORM TIPS veröffentlicht Sportanalysen zu Informationszwecken. Kein Ergebnis ist garantiert. 18+.',
    verifySubject: 'Bestätige deine E-Mail-Adresse',
    verifyBody:
      'Klicke auf den Button, um dein STORM TIPS Konto zu aktivieren. Der Link ist 24 Stunden gültig.',
    verifyCta: 'E-Mail bestätigen',
    verifyText: (url: string) =>
      `Bestätige deine E-Mail-Adresse: ${url}\n\nDer Link ist 24 Stunden gültig.`,
    resetSubject: 'Passwort zurücksetzen',
    resetBody:
      'Der Link ist 60 Minuten gültig. Wenn du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren — dein Passwort bleibt unverändert.',
    resetCta: 'Neues Passwort setzen',
    resetText: (url: string) =>
      `Setze dein Passwort zurück: ${url}\n\nDer Link ist 60 Minuten gültig. Wenn du das nicht angefordert hast, ignoriere diese E-Mail.`,
    expiringSubject: (product: string, days: number) =>
      `Dein ${product}-Zugang endet in ${days} Tagen`,
    expiringBody: 'Du kannst dein Abo jederzeit in der App verlängern oder kündigen.',
    expiringCta: 'Abo verwalten',
    expiringText: (product: string, days: number) =>
      `Dein ${product}-Zugang endet in ${days} Tagen. Verlängere jederzeit in der App.`,
  },
  en: {
    footer: 'STORM TIPS publishes sports analyses for information. No outcome is guaranteed. 18+.',
    verifySubject: 'Confirm your email address',
    verifyBody:
      'Tap the button to activate your STORM TIPS account. The link is valid for 24 hours.',
    verifyCta: 'Confirm email',
    verifyText: (url: string) =>
      `Confirm your email address: ${url}\n\nThe link is valid for 24 hours.`,
    resetSubject: 'Reset your password',
    resetBody:
      'The link is valid for 60 minutes. If you did not request this you can ignore this email — your password stays unchanged.',
    resetCta: 'Set a new password',
    resetText: (url: string) =>
      `Reset your password: ${url}\n\nThe link is valid for 60 minutes. If you did not request it, ignore this email.`,
    expiringSubject: (product: string, days: number) =>
      `Your ${product} access ends in ${days} days`,
    expiringBody: 'You can renew or cancel your subscription in the app at any time.',
    expiringCta: 'Manage subscription',
    expiringText: (product: string, days: number) =>
      `Your ${product} access ends in ${days} days. Renew any time in the app.`,
  },
};

function copyFor(locale: string): MailCopy {
  const short = locale.split('-')[0]?.toLowerCase() ?? '';
  return short === 'en' ? MAIL_COPY.en : MAIL_COPY.de;
}

export function verificationEmail(token: string, locale = 'de'): Omit<MailInput, 'to'> {
  const url = `${env.WEB_PUBLIC_URL}/auth/verify?token=${token}`;
  const copy = copyFor(locale);
  return {
    subject: copy.verifySubject,
    text: copy.verifyText(url),
    html: layout(copy.verifySubject, copy.verifyBody, copy.verifyCta, url, copy.footer, locale),
  };
}

export function passwordResetEmail(token: string, locale = 'de'): Omit<MailInput, 'to'> {
  const url = `${env.WEB_PUBLIC_URL}/auth/reset?token=${token}`;
  const copy = copyFor(locale);
  return {
    subject: copy.resetSubject,
    text: copy.resetText(url),
    html: layout(copy.resetSubject, copy.resetBody, copy.resetCta, url, copy.footer, locale),
  };
}

export function subscriptionExpiringEmail(
  product: string,
  days: number,
  locale = 'de',
): Omit<MailInput, 'to'> {
  const copy = copyFor(locale);
  const subject = copy.expiringSubject(product, days);
  return {
    subject,
    text: copy.expiringText(product, days),
    html: layout(
      subject,
      copy.expiringBody,
      copy.expiringCta,
      `${env.WEB_PUBLIC_URL}/account/subscription`,
      copy.footer,
      locale,
    ),
  };
}
