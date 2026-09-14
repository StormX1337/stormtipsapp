'use client';

import { Suspense, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { AuthCard, Field, FormError } from '@/components/auth-form';
import { Button } from '@/components/primitives';

function ResetForm(): ReactNode {
  const t = useT();
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        auth: false,
        body: { token, password },
      });
      setDone(true);
      setTimeout(() => router.push('/auth/login'), 1500);
    } catch (caught) {
      const details = (caught as { details?: { issues?: { message: string }[] } }).details;
      setError(details?.issues?.[0]?.message ?? (caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return <FormError message="This link is incomplete. Request a new one." />;
  }
  if (done) {
    return (
      <p className="rounded-md bg-accent-500/10 px-3 py-3 text-[13px] text-accent-300">
        Password changed. Taking you to the sign-in page…
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <FormError message={error} />
      <Field
        label={t('auth.password')}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint={t('auth.passwordRules')}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Button type="submit" size="lg" disabled={busy}>
        {busy ? t('common.loading') : t('auth.resetPassword')}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage(): ReactNode {
  return (
    <AuthCard
      title="Set a new password"
      footer={
        <Link href="/auth/login" className="text-ink-muted hover:text-ink">
          Zur Anmeldung
        </Link>
      }
    >
      <Suspense fallback={null}>
        <ResetForm />
      </Suspense>
    </AuthCard>
  );
}
