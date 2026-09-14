'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { AuthCard, FormError } from '@/components/auth-form';

function VerifyContent(): ReactNode {
  const t = useT();
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<'pending' | 'done' | 'error'>('pending');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState('error');
      setError('This confirmation link is incomplete.');
      return;
    }
    void (async () => {
      try {
        await api('/auth/verify-email', { method: 'POST', auth: false, body: { token } });
        setState('done');
      } catch (caught) {
        setState('error');
        setError((caught as Error).message);
      }
    })();
  }, [token]);

  if (state === 'pending')
    return <p className="text-[13px] text-ink-muted">{t('common.loading')}</p>;
  if (state === 'error') return <FormError message={error} />;
  return (
    <p className="rounded-md bg-accent-500/10 px-3 py-3 text-[13px] text-accent-300">
      {t('auth.verified')}
    </p>
  );
}

export default function VerifyEmailPage(): ReactNode {
  return (
    <AuthCard
      title="Confirm your email"
      footer={
        <Link href="/free" className="text-accent-500 hover:underline">
          Zur App
        </Link>
      }
    >
      <Suspense fallback={null}>
        <VerifyContent />
      </Suspense>
    </AuthCard>
  );
}
