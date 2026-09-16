'use client';

import { Fragment, Suspense, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { AuthCard, Field, FormError } from '@/components/auth-form';
import { Button } from '@/components/primitives';

/**
 * Renders a translated sentence whose `{placeholder}` markers become nodes.
 *
 * The legal consent line has to carry two links inside a full sentence, and
 * the two languages do not order that sentence the same way — assembling it
 * from fragments in the component would bake German word order into the
 * English copy.
 */
function withNodes(template: string, nodes: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{[a-zA-Z]+\})/).map((part, index) => {
    const key = part.startsWith('{') && part.endsWith('}') ? part.slice(1, -1) : null;
    return key && key in nodes ? <Fragment key={index}>{nodes[key]}</Fragment> : part;
  });
}

function RegisterForm(): ReactNode {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register } = useAuth();
  const [form, setForm] = useState({
    email: '',
    password: '',
    displayName: '',
    referralCode: searchParams.get('ref') ?? '',
  });
  const [accepted, setAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!accepted || !ageConfirmed) {
      setError(t('auth.confirmRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register({
        email: form.email,
        password: form.password,
        displayName: form.displayName || undefined,
        referralCode: form.referralCode || undefined,
        marketingOptIn,
      });
      router.push('/free');
    } catch (caught) {
      const details = (caught as { details?: { issues?: { message: string }[] } }).details;
      setError(details?.issues?.[0]?.message ?? (caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <FormError message={error} />
      <Field
        label={t('auth.displayName')}
        name="displayName"
        autoComplete="nickname"
        value={form.displayName}
        onChange={(event) => setForm({ ...form, displayName: event.target.value })}
      />
      <Field
        label={t('auth.email')}
        name="email"
        type="email"
        autoComplete="email"
        required
        value={form.email}
        onChange={(event) => setForm({ ...form, email: event.target.value })}
      />
      <Field
        label={t('auth.password')}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint={t('auth.passwordRules')}
        value={form.password}
        onChange={(event) => setForm({ ...form, password: event.target.value })}
      />
      <Field
        label={`${t('auth.referralCode')} (${t('common.optional')})`}
        name="referralCode"
        value={form.referralCode}
        onChange={(event) => setForm({ ...form, referralCode: event.target.value.toUpperCase() })}
      />

      <label className="flex items-start gap-2 text-[12px] text-ink-muted">
        <input
          type="checkbox"
          checked={ageConfirmed}
          onChange={(event) => setAgeConfirmed(event.target.checked)}
          className="mt-px h-4 w-4 shrink-0 accent-[#12E17F]"
          required
        />
        <span>{t('auth.confirmAge')}</span>
      </label>
      <label className="flex items-start gap-2 text-[12px] text-ink-muted">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className="mt-px h-4 w-4 shrink-0 accent-[#12E17F]"
          required
        />
        <span>
          {withNodes(t('auth.acceptTermsLinked'), {
            terms: (
              <Link href="/legal/terms" className="text-accent-500 hover:underline">
                {t('auth.termsLinkLabel')}
              </Link>
            ),
            privacy: (
              <Link href="/legal/privacy" className="text-accent-500 hover:underline">
                {t('auth.privacyLinkLabel')}
              </Link>
            ),
          })}
        </span>
      </label>
      <label className="flex items-start gap-2 text-[12px] text-ink-muted">
        <input
          type="checkbox"
          checked={marketingOptIn}
          onChange={(event) => setMarketingOptIn(event.target.checked)}
          className="mt-px h-4 w-4 shrink-0 accent-[#12E17F]"
        />
        <span>{t('auth.marketingOptIn')}</span>
      </label>

      <Button type="submit" size="lg" disabled={busy}>
        {busy ? t('common.loading') : t('auth.register')}
      </Button>
    </form>
  );
}

export default function RegisterPage(): ReactNode {
  const t = useT();
  return (
    <AuthCard
      title={t('auth.register')}
      subtitle={t('auth.registerSubtitle')}
      footer={
        <span className="text-ink-muted">
          {t('auth.hasAccount')}{' '}
          <Link href="/auth/login" className="font-semibold text-accent-500 hover:underline">
            {t('auth.login')}
          </Link>
        </span>
      }
    >
      <Suspense fallback={null}>
        <RegisterForm />
      </Suspense>
    </AuthCard>
  );
}
