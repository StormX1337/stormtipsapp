'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { AuthCard, Field, FormError } from '@/components/auth-form';
import { Button } from '@/components/primitives';

export default function ForgotPasswordPage(): ReactNode {
  const t = useT();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/auth/forgot-password', { method: 'POST', auth: false, body: { email } });
      setSent(true);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title={t('auth.resetPassword')}
      subtitle="We will email you a link to reset it."
      footer={
        <Link href="/auth/login" className="text-ink-muted hover:text-ink">
          {t('common.back')}
        </Link>
      }
    >
      {sent ? (
        <p className="rounded-md bg-accent-500/10 px-3 py-3 text-[13px] text-accent-300">
          {t('auth.resetSent')}
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <FormError message={error} />
          <Field
            label={t('auth.email')}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? t('common.loading') : t('auth.resetPassword')}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
