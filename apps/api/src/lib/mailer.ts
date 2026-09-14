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
): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head>
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

/** Transactional copy. */
const COPY: MailCopy = {
  footer: 'STORM TIPS publishes sports analyses for information. No outcome is guaranteed. 18+.',
  verifySubject: 'Confirm your email address',
  verifyBody: 'Tap the button to activate your STORM TIPS account. The link is valid for 24 hours.',
  verifyCta: 'Confirm email',
  verifyText: (url: string) =>
    `Confirm your email address: ${url}\n\nThe link is valid for 24 hours.`,
  resetSubject: 'Reset your password',
  resetBody:
    'The link is valid for 60 minutes. If you did not request this you can ignore this email — your password stays unchanged.',
  resetCta: 'Set a new password',
  resetText: (url: string) =>
    `Reset your password: ${url}\n\nThe link is valid for 60 minutes. If you did not request it, ignore this email.`,
  expiringSubject: (product: string, days: number) => `Your ${product} access ends in ${days} days`,
  expiringBody: 'You can renew or cancel your subscription in the app at any time.',
  expiringCta: 'Manage subscription',
  expiringText: (product: string, days: number) =>
    `Your ${product} access ends in ${days} days. Renew any time in the app.`,
};

export function verificationEmail(token: string): Omit<MailInput, 'to'> {
  const url = `${env.WEB_PUBLIC_URL}/auth/verify?token=${token}`;
  return {
    subject: COPY.verifySubject,
    text: COPY.verifyText(url),
    html: layout(COPY.verifySubject, COPY.verifyBody, COPY.verifyCta, url, COPY.footer),
  };
}

export function passwordResetEmail(token: string): Omit<MailInput, 'to'> {
  const url = `${env.WEB_PUBLIC_URL}/auth/reset?token=${token}`;
  return {
    subject: COPY.resetSubject,
    text: COPY.resetText(url),
    html: layout(COPY.resetSubject, COPY.resetBody, COPY.resetCta, url, COPY.footer),
  };
}

export function subscriptionExpiringEmail(product: string, days: number): Omit<MailInput, 'to'> {
  const subject = COPY.expiringSubject(product, days);
  return {
    subject,
    text: COPY.expiringText(product, days),
    html: layout(
      subject,
      COPY.expiringBody,
      COPY.expiringCta,
      `${env.WEB_PUBLIC_URL}/account/subscription`,
      COPY.footer,
    ),
  };
}
