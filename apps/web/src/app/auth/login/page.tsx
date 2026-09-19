'use client';

import { Suspense, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { AuthCard, Field, FormError } from '@/components/auth-form';
import { Button } from '@/components/primitives';

function LoginForm(): ReactNode {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      /*
       * A beat on the tick before the feed replaces the page. Sign-in usually
       * answers faster than it takes to read, so without it the screen simply
       * changes and it is not obvious anything was accepted.
       */
      setDone(true);
      setTimeout(() => router.push(searchParams.get('next') ?? '/free'), 420);
      return;
    } catch (caught) {
      const code = (caught as { code?: string }).code;
      setAttempt((value) => value + 1);
      setError(
        code === 'INVALID_CREDENTIALS'
          ? t('auth.invalidCredentials')
          : code === 'ACCOUNT_BANNED'
            ? t('auth.accountBanned')
            : (caught as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <FormError message={error} attempt={attempt} />
      <Field
        label={t('auth.email')}
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Field
        label={t('auth.password')}
        name="password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Button type="submit" size="lg" loading={busy} done={done}>
        {t('auth.login')}
      </Button>
      <Link href="/auth/forgot" className="text-center text-[12px] text-ink-muted hover:text-ink">
        {t('auth.forgotPassword')}
      </Link>
    </form>
  );
}

export default function LoginPage(): ReactNode {
  const t = useT();
  return (
    <AuthCard
      title={t('auth.login')}
      subtitle={t('auth.loginSubtitle')}
      footer={
        <span className="text-ink-muted">
          {t('auth.noAccount')}{' '}
          <Link href="/auth/register" className="font-semibold text-accent-500 hover:underline">
            {t('auth.register')}
          </Link>
        </span>
      }
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
