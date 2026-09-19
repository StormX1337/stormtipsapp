'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import { config } from '@/lib/config';
import { useT } from '@/lib/i18n';

/** Shared shell for every authentication screen. */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}): ReactNode {
  const t = useT();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      {/* The wordmark, the card and the footer arrive as one movement rather
          than three, which is what the small stagger buys. */}
      <Link href="/free" className="animate-rise mb-8 text-center">
        <span className="text-[22px] font-black tracking-tight text-accent-500">
          {config.appName}
        </span>
      </Link>

      <div className="card animate-rise animate-rise-1 p-6">
        <h1 className="text-[20px] font-extrabold">{title}</h1>
        {subtitle ? <p className="mt-1 text-[13px] text-ink-muted">{subtitle}</p> : null}
        <div className="mt-5">{children}</div>
      </div>

      {footer ? (
        <div className="animate-rise animate-rise-2 mt-5 text-center text-[13px]">{footer}</div>
      ) : null}

      <p className="mt-8 text-center text-[11px] leading-relaxed text-ink-dim">
        {t('legal.ageNotice')} {t('legal.noGuarantee')}
      </p>
    </main>
  );
}

export function Field({
  label,
  error,
  hint,
  ...props
}: {
  label: string;
  error?: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>): ReactNode {
  const id = props.id ?? props.name;
  return (
    <label htmlFor={id} className="block">
      <span className="field-label mb-1 block text-[12px] font-semibold text-ink-muted">
        {label}
      </span>
      <input
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={clsx(
          'field-input w-full rounded-md border bg-bg-input px-3 py-2.5 text-[14px] text-ink outline-none',
          'placeholder:text-ink-disabled',
          error ? 'border-lost' : 'border-line focus:border-accent-500',
        )}
      />
      {error ? (
        <span id={`${id}-error`} role="alert" className="mt-1 block text-[11px] text-lost">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="mt-1 block text-[11px] text-ink-dim">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

/** The four things `passwordRules` asks for, checked as they are typed. */
export function passwordScore(value: string): number {
  return [/.{10,}/, /[a-z]/, /[A-Z]/, /\d/].filter((rule) => rule.test(value)).length;
}

/**
 * Password strength, filling as the rules are met.
 *
 * The rules were written above the field and then never referred to again, so
 * the only way to learn you had missed one was to submit. Four segments, one
 * per rule, and a word for the ones that cannot see the colour.
 */
export function PasswordMeter({ value }: { value: string }): ReactNode {
  const t = useT();
  const score = passwordScore(value);
  if (!value) return null;

  const tone =
    score === 4
      ? 'bg-accent-500'
      : score === 3
        ? 'bg-gold-400'
        : score === 2
          ? 'bg-gold-300'
          : 'bg-lost';

  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={clsx(
              'h-1 flex-1 rounded-full transition-colors duration-300',
              index < score ? tone : 'bg-line-strong',
            )}
          />
        ))}
      </div>
      <p className="mt-1 text-[11px] text-ink-dim" role="status">
        {t(score === 4 ? 'auth.passwordStrong' : 'auth.passwordRules')}
      </p>
    </div>
  );
}

export function FormError({
  message,
  /**
   * Incremented by the caller on every failed attempt. The common failure is
   * the same password typed twice, and keying on the text alone leaves the node
   * in place — the shake would play once and never again, which reads as the
   * button having stopped responding.
   */
  attempt = 0,
}: {
  message: string | null;
  attempt?: number;
}): ReactNode {
  if (!message) return null;
  return (
    <p
      key={`${attempt}:${message}`}
      role="alert"
      className="animate-shake rounded-md bg-lost/15 px-3 py-2 text-[12px] text-lost"
    >
      {message}
    </p>
  );
}
