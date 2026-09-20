'use client';

import Link from 'next/link';
import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, LineChart, ShieldCheck } from 'lucide-react';
import type { ProductDTO } from '@storm-tips/types';
import { api } from '@/lib/api';
import { config } from '@/lib/config';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/primitives';
import { useCountUp } from '@/lib/use-reveal';

interface Headline {
  days: number;
  successfulAnalyses: number;
  roi: number;
  averageOdds: number;
  winRate: number;
  totalTips: number;
  stake: number;
}

/**
 * One verified figure. The number counts up because these three are the claim
 * the page is making, and they are read rather than glanced at.
 */
function Figure({
  label,
  value,
  format,
}: {
  label: string;
  value: number;
  format: (value: number) => string;
}): ReactNode {
  const counted = useCountUp(value);
  return (
    <div className="card px-4 py-5 text-center">
      <p className="tabular text-[28px] leading-none font-extrabold text-accent-500 md:text-[34px]">
        {format(counted)}
      </p>
      <p className="mt-2 text-[12px] font-semibold tracking-wide text-ink-muted uppercase">
        {label}
      </p>
    </div>
  );
}

/**
 * The public front page.
 *
 * Until now `/` redirected straight into the free feed, so a first-time visitor
 * met a list of fixtures with no idea what the product was or why its numbers
 * could be trusted. Someone already signed in still goes to the feed — they
 * have read this once.
 *
 * Every figure here is fetched, never written into the markup: the record has
 * to be the same one the statistics page shows, or it is marketing.
 */
export default function HomePage(): ReactNode {
  const { t } = useI18n();
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) router.replace('/free');
  }, [loading, user, router]);

  const headline = useQuery({
    queryKey: ['headline', 'FREE'],
    queryFn: () => api<Headline>('/tips/free/headline'),
  });
  const products = useQuery({
    queryKey: ['products'],
    queryFn: () => api<{ items: ProductDTO[] }>('/billing/products'),
  });

  const stats = headline.data;

  return (
    <main className="min-h-dvh bg-bg-base">
      <header className="border-b border-line-subtle">
        <div className="mx-auto flex h-[60px] max-w-6xl items-center justify-between px-5 md:px-6">
          <span className="text-[17px] font-black tracking-tight text-accent-500">
            {config.appName}
          </span>
          <div className="flex items-center gap-2">
            <Link
              href="/auth/login"
              className="px-3 py-2 text-[13px] font-semibold text-ink-muted hover:text-ink"
            >
              {t('auth.login')}
            </Link>
            <Link href="/auth/register">
              <Button size="sm">{t('landing.cta')}</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="ambient-accent mx-auto grid max-w-6xl gap-10 px-5 pt-14 pb-14 md:px-6 md:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="animate-rise text-accent-500 mb-4 inline-flex items-center gap-2 rounded-full border border-accent-500/25 bg-accent-500/10 px-3 py-1 text-[11.5px] font-bold tracking-wide uppercase">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-accent-500" aria-hidden />
            {t('landing.badge')}
          </p>
          <h1 className="animate-rise max-w-3xl text-[32px] leading-[1.1] font-extrabold tracking-tight text-balance md:text-[52px]">
            {t('landing.headline')}
          </h1>
          <p className="animate-rise animate-rise-1 mt-5 max-w-2xl text-[15px] leading-relaxed text-ink-muted md:text-[17px]">
            {t('landing.sub')}
          </p>
          <div className="animate-rise animate-rise-2 mt-8 flex flex-wrap items-center gap-3">
            <Link href="/auth/register">
              <Button size="md">
                {t('landing.cta')} <ArrowRight size={16} aria-hidden />
              </Button>
            </Link>
            <Link href="/free">
              <Button size="md" variant="outline">
                {t('landing.secondary')}
              </Button>
            </Link>
          </div>
        </div>

        {/*
         * The record sits beside the claim, not three screens below it: the
         * headline says the figures are checkable, so the figures belong where
         * the reader is when they read that.
         */}
        {stats ? (
          <div className="animate-rise animate-rise-2">
            <h2 className="mb-4 text-[13px] font-semibold tracking-wide text-ink-dim uppercase">
              {t('landing.recordTitle')}
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <Figure
                label={t('stats.winRate')}
                value={stats.winRate}
                format={(value) => `${value.toFixed(1)}%`}
              />
              <Figure
                label={t('stats.returnOnPurchase')}
                value={stats.roi}
                format={(value) => `${value.toFixed(1)}%`}
              />
              <Figure
                label={t('stats.totalTips')}
                value={stats.totalTips}
                format={(value) => Math.round(value).toLocaleString('en-GB')}
              />
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-ink-dim">
              {t('landing.recordNote', { days: stats.days, stake: stats.stake })}
            </p>
            <Link
              href="/statistics"
              className="text-accent-500 mt-2 inline-flex items-center gap-1 text-[12px] font-semibold hover:underline"
            >
              {t('nav.statistics')} <ArrowRight size={13} aria-hidden />
            </Link>
          </div>
        ) : null}
      </section>

      <section className="border-y border-line-subtle bg-bg-subtle">
        <div className="mx-auto max-w-6xl px-5 py-14 md:px-6">
          <h2 className="text-[22px] font-extrabold tracking-tight md:text-[26px]">
            {t('landing.howTitle')}
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { Icon: CheckCircle2, title: t('landing.how1Title'), body: t('landing.how1Body') },
              { Icon: ShieldCheck, title: t('landing.how2Title'), body: t('landing.how2Body') },
              { Icon: LineChart, title: t('landing.how3Title'), body: t('landing.how3Body') },
            ].map(({ Icon, title, body }) => (
              <div key={title} className="card p-5">
                <Icon size={20} className="text-accent-500" aria-hidden />
                <h3 className="mt-3 text-[15px] font-bold">{title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {products.data ? (
        <section className="mx-auto max-w-6xl px-5 py-14 md:px-6">
          <h2 className="text-[22px] font-extrabold tracking-tight md:text-[26px]">
            {t('landing.productsTitle')}
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.data.items.map((product) => (
              <div key={product.code} className="card card-interactive p-5">
                <p className="text-[15px] font-bold" style={{ color: product.color ?? undefined }}>
                  {product.name}
                </p>
                {product.tagline ? (
                  <p className="mt-1 text-[13px] text-ink-muted">{product.tagline}</p>
                ) : null}
                <ul className="mt-3 flex flex-col gap-1.5">
                  {product.benefits.slice(0, 4).map((benefit) => (
                    <li key={benefit} className="flex gap-2 text-[12.5px] text-ink-muted">
                      <CheckCircle2
                        size={14}
                        className="mt-0.5 shrink-0 text-accent-500"
                        aria-hidden
                      />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <footer className="border-t border-line-subtle">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 md:flex-row md:items-center md:justify-between md:px-6">
          <p className="max-w-2xl text-[11.5px] leading-relaxed text-ink-dim">
            {t('legal.ageNotice')} {t('legal.noGuarantee')}
          </p>
          <nav className="flex flex-wrap gap-4 text-[12px] text-ink-muted">
            <Link href="/legal/terms" className="hover:text-ink">
              {t('auth.termsLinkLabel')}
            </Link>
            <Link href="/legal/privacy" className="hover:text-ink">
              {t('auth.privacyLinkLabel')}
            </Link>
            <Link href="/legal/responsible-gambling" className="hover:text-ink">
              {t('legal.responsible')}
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
