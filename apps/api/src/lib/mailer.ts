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

function layout(title: string, body: string, ctaLabel?: string, ctaUrl?: string): string {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0A0C10;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#fff">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#151821;border-radius:16px;padding:28px">
        <tr><td style="font-size:20px;font-weight:800;letter-spacing:.5px;color:#12E17F;padding-bottom:16px">PROFIT TIPS</td></tr>
        <tr><td style="font-size:18px;font-weight:700;padding-bottom:12px">${title}</td></tr>
        <tr><td style="font-size:14px;line-height:1.6;color:#9BA5B7">${body}</td></tr>
        ${
          ctaUrl
            ? `<tr><td style="padding-top:24px"><a href="${ctaUrl}" style="display:inline-block;background:#12E17F;color:#0A0C10;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px">${ctaLabel}</a></td></tr>
               <tr><td style="padding-top:16px;font-size:12px;color:#6C7688;word-break:break-all">${ctaUrl}</td></tr>`
            : ''
        }
        <tr><td style="padding-top:28px;font-size:11px;color:#6C7688;line-height:1.6">
          PROFIT TIPS veröffentlicht Sportanalysen zu Informationszwecken. Kein Ergebnis ist garantiert. 18+.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function verificationEmail(token: string): Omit<MailInput, 'to'> {
  const url = `${env.WEB_PUBLIC_URL}/auth/verify?token=${token}`;
  return {
    subject: 'Bestätige deine E-Mail-Adresse',
    text: `Bestätige deine E-Mail-Adresse: ${url}\n\nDer Link ist 24 Stunden gültig.`,
    html: layout(
      'Bestätige deine E-Mail-Adresse',
      'Klicke auf den Button, um dein PROFIT TIPS Konto zu aktivieren. Der Link ist 24 Stunden gültig.',
      'E-Mail bestätigen',
      url,
    ),
  };
}

export function passwordResetEmail(token: string): Omit<MailInput, 'to'> {
  const url = `${env.WEB_PUBLIC_URL}/auth/reset?token=${token}`;
  return {
    subject: 'Passwort zurücksetzen',
    text: `Setze dein Passwort zurück: ${url}\n\nDer Link ist 60 Minuten gültig. Wenn du das nicht angefordert hast, ignoriere diese E-Mail.`,
    html: layout(
      'Passwort zurücksetzen',
      'Der Link ist 60 Minuten gültig. Wenn du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren — dein Passwort bleibt unverändert.',
      'Neues Passwort setzen',
      url,
    ),
  };
}

export function subscriptionExpiringEmail(product: string, days: number): Omit<MailInput, 'to'> {
  return {
    subject: `Dein ${product}-Zugang endet in ${days} Tagen`,
    text: `Dein ${product}-Zugang endet in ${days} Tagen. Verlängere jederzeit in der App.`,
    html: layout(
      `Dein ${product}-Zugang endet in ${days} Tagen`,
      'Du kannst dein Abo jederzeit in der App verlängern oder kündigen.',
      'Abo verwalten',
      `${env.WEB_PUBLIC_URL}/account/subscription`,
    ),
  };
}
