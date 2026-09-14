'use client';

import clsx from 'clsx';
import { X } from 'lucide-react';
import {
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: {
  children: ReactNode;
  variant?: 'primary' | 'gold' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md';
} & ButtonHTMLAttributes<HTMLButtonElement>): ReactNode {
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-sm font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-2.5 py-1.5 text-[12px]' : 'px-3.5 py-2 text-[13px]',
        variant === 'primary' && 'bg-accent-500 text-ink-inverse hover:bg-accent-400',
        variant === 'gold' && 'bg-gold-400 text-ink-inverse hover:bg-gold-300',
        variant === 'ghost' && 'text-ink-muted hover:bg-bg-card-alt hover:text-ink',
        variant === 'outline' && 'border border-line text-ink hover:border-accent-500',
        variant === 'danger' && 'bg-lost/15 text-lost hover:bg-lost/25',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  error,
  ...props
}: {
  label: string;
  hint?: string;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>): ReactNode {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input {...props} className={clsx('input', error && 'border-lost', props.className)} />
      {error ? <span className="mt-1 block text-[11px] text-lost">{error}</span> : null}
      {!error && hint ? <span className="mt-1 block text-[11px] text-ink-dim">{hint}</span> : null}
    </label>
  );
}

export function TextArea({
  label,
  ...props
}: { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>): ReactNode {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <textarea {...props} className={clsx('input min-h-24', props.className)} />
    </label>
  );
}

export function Select({
  label,
  options,
  hint,
  ...props
}: {
  label: string;
  options: { value: string; label: string }[];
  hint?: string;
} & SelectHTMLAttributes<HTMLSelectElement>): ReactNode {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select {...props} className={clsx('input', props.className)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <span className="mt-1 block text-[11px] text-ink-dim">{hint}</span> : null}
    </label>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}): ReactNode {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[#12E17F]"
      />
      <span className="text-[12.5px]">{label}</span>
    </label>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}): ReactNode {
  // Escape closes the dialog and the background is locked while it is open.
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={clsx('card my-8 w-full', wide ? 'max-w-3xl' : 'max-w-xl')}>
        <header className="flex items-center justify-between border-b border-line-subtle px-4 py-3">
          <h2 className="text-[14px] font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-sm text-ink-dim hover:bg-bg-card-alt hover:text-ink"
          >
            <X size={16} aria-hidden />
          </button>
        </header>
        <div className="px-4 py-4">{children}</div>
        {footer ? (
          <footer className="flex justify-end gap-2 border-t border-line-subtle px-4 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'positive' | 'negative' | 'warning' | 'info';
}): ReactNode {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10.5px] font-bold tracking-wide uppercase',
        tone === 'neutral' && 'bg-bg-card-alt text-ink-muted',
        tone === 'positive' && 'bg-won/15 text-won',
        tone === 'negative' && 'bg-lost/15 text-lost',
        tone === 'warning' && 'bg-gold-400/15 text-gold-300',
        tone === 'info' && 'bg-cyan-500/15 text-cyan-500',
      )}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}): ReactNode {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[20px] font-extrabold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-[12.5px] text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </header>
  );
}

export function Skeleton({ className }: { className?: string }): ReactNode {
  return <div className={clsx('skeleton', className)} aria-hidden />;
}

/**
 * Shows the server's message and, for a rejected body, which field it objected
 * to — "Invalid request body" on its own tells an operator nothing about which
 * of a dozen inputs to correct.
 */
export function ErrorBox({ error }: { error: unknown }): ReactNode {
  const message = (error as Error)?.message ?? 'Something went wrong';
  const issues = (
    error as { details?: { issues?: { path?: (string | number)[]; message: string }[] } }
  )?.details?.issues;

  return (
    <div role="alert" className="rounded-md bg-lost/15 px-3 py-2 text-[12.5px] text-lost">
      <p>{message}</p>
      {issues && issues.length > 0 ? (
        <ul className="mt-1 list-disc pl-4">
          {issues.map((issue, index) => (
            <li key={index}>
              {issue.path && issue.path.length > 0 ? <b>{issue.path.join('.')}: </b> : null}
              {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
}

/** Generic table used by every resource screen in the console. */
export function DataTable<T>({
  columns,
  rows,
  empty = 'No entries',
  loading,
  rowKey,
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
  loading?: boolean;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
}): ReactNode {
  if (loading) {
    return (
      <div className="card p-3">
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] text-left">
        <thead className="border-b border-line-subtle text-[11px] tracking-wide text-ink-dim uppercase">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                style={column.width ? { width: column.width } : undefined}
                className={clsx(
                  'px-3 py-2.5 font-semibold',
                  column.align === 'right' && 'text-right',
                  column.align === 'center' && 'text-center',
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-subtle">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-10 text-center text-ink-dim">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={clsx(onRowClick && 'cursor-pointer hover:bg-bg-card-alt')}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={clsx(
                      'px-3 py-2.5 text-[12.5px]',
                      column.align === 'right' && 'text-right',
                      column.align === 'center' && 'text-center',
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}): ReactNode {
  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </Button>
      <span className="text-[12px] text-ink-dim">
        Page {page} of {Math.max(1, totalPages)}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}
