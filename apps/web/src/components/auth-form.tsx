'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import { config } from '@/lib/config';

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
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <Link href="/free" className="mb-8 text-center">
        <span className="text-[22px] font-black tracking-tight text-accent-500">
          {config.appName}
        </span>
      </Link>

      <div className="card p-6">
        <h1 className="text-[20px] font-extrabold">{title}</h1>
        {subtitle ? <p className="mt-1 text-[13px] text-ink-muted">{subtitle}</p> : null}
        <div className="mt-5">{children}</div>
      </div>

      {footer ? <div className="mt-5 text-center text-[13px]">{footer}</div> : null}

      <p className="mt-8 text-center text-[11px] leading-relaxed text-ink-dim">
        18+ · Wetten ist mit finanziellem Risiko verbunden. PROFIT TIPS veröffentlicht Analysen zu
        Informationszwecken; kein Ergebnis ist garantiert.
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
      <span className="mb-1 block text-[12px] font-semibold text-ink-muted">{label}</span>
      <input
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={clsx(
          'w-full rounded-md border bg-bg-input px-3 py-2.5 text-[14px] text-ink outline-none',
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

export function FormError({ message }: { message: string | null }): ReactNode {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-lost/15 px-3 py-2 text-[12px] text-lost">
      {message}
    </p>
  );
}
