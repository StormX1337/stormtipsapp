'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import type { PaymentDTO, Paginated, SubscriptionDTO } from '@storm-tips/types';
import { formatDateTime } from '@storm-tips/ui';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/navigation';
import { ErrorState } from '@/components/states';
import { Button, Skeleton } from '@/components/primitives';

export default function SubscriptionPage(): ReactNode {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();

  const subscriptions = useQuery({
    queryKey: ['my-subscriptions'],
    queryFn: () => api<{ items: SubscriptionDTO[] }>('/me/subscriptions'),
  });

  const payments = useQuery({
    queryKey: ['my-payments'],
    queryFn: () => api<Paginated<PaymentDTO>>('/me/payments?limit=25'),
  });

  const restore = useMutation({
    mutationFn: () => api('/billing/purchases/restore', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const cancel = useMutation({
    mutationFn: (subscriptionId: string) =>
      api('/billing/subscriptions/cancel', { method: 'POST', body: { subscriptionId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-subscriptions'] }),
  });

  const active = subscriptions.data?.items.filter(
    (subscription) => subscription.status !== 'EXPIRED',
  );

  return (
    <AppShell
      measure="narrow"
      title={t('subscription.title')}
      right={
        <button
          type="button"
          onClick={() => restore.mutate()}
          className="text-[12px] text-ink-muted hover:text-ink"
        >
          {t('paywall.restore')}
        </button>
      }
    >
      <div id="main" className="flex flex-col gap-4 py-4">
        {subscriptions.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : subscriptions.isError ? (
          <ErrorState error={subscriptions.error} onRetry={() => void subscriptions.refetch()} />
        ) : active && active.length > 0 ? (
          active.map((subscription) => (
            <section key={subscription.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[15px] font-bold">
                    {subscription.plan?.name ?? subscription.products.join(' + ')}
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-dim">{subscription.provider}</p>
                </div>
                <span
                  className={clsx(
                    'rounded-sm px-2 py-0.5 text-[11px] font-bold uppercase',
                    subscription.status === 'ACTIVE'
                      ? 'bg-won/15 text-won'
                      : subscription.status === 'CANCELED'
                        ? 'bg-gold-400/15 text-gold-300'
                        : 'bg-bg-card-alt text-ink-muted',
                  )}
                >
                  {subscription.status}
                </span>
              </div>

              <dl className="mt-3 divide-y divide-line-subtle border-t border-line-subtle">
                <div className="flex justify-between py-2 text-[12.5px]">
                  <dt className="text-ink-muted">
                    {subscription.willRenew
                      ? t('subscription.renewsOn')
                      : t('subscription.expiresOn')}
                  </dt>
                  <dd className="font-semibold">
                    {subscription.currentPeriodEnd
                      ? formatDateTime(subscription.currentPeriodEnd, undefined, locale)
                      : '—'}
                  </dd>
                </div>
                {subscription.daysRemaining !== null ? (
                  <div className="flex justify-between py-2 text-[12.5px]">
                    <dt className="text-ink-muted">{t('subscription.status')}</dt>
                    <dd className="font-semibold">
                      {t('subscription.daysRemaining', { days: subscription.daysRemaining })}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {subscription.willRenew ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  disabled={cancel.isPending}
                  onClick={() => {
                    if (window.confirm(t('subscription.cancelConfirm'))) {
                      cancel.mutate(subscription.id);
                    }
                  }}
                >
                  {t('subscription.cancel')}
                </Button>
              ) : null}

              {cancel.isError ? (
                <p role="alert" className="mt-2 text-[12px] text-lost">
                  {(cancel.error as Error).message}
                </p>
              ) : null}
            </section>
          ))
        ) : (
          <section className="card p-6 text-center">
            <p className="text-[14px] text-ink-muted">{t('subscription.none')}</p>
            <Link href="/combo" className="mt-3 inline-block">
              <Button variant="gold">{t('paywall.getCombo')}</Button>
            </Link>
          </section>
        )}

        <section className="card overflow-hidden">
          <h2 className="border-b border-line-subtle px-3 py-2.5 text-[13px] font-bold">
            {t('subscription.history')}
          </h2>
          {payments.isPending ? (
            <Skeleton className="m-3 h-24" />
          ) : payments.data && payments.data.items.length > 0 ? (
            <ul className="divide-y divide-line-subtle">
              {payments.data.items.map((payment) => (
                <li key={payment.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px]">
                      {payment.description ?? payment.provider}
                    </p>
                    <p className="text-[11px] text-ink-dim">
                      {payment.paidAt
                        ? formatDateTime(payment.paidAt, undefined, locale)
                        : formatDateTime(payment.createdAt, undefined, locale)}
                      {payment.invoiceNumber ? ` · ${payment.invoiceNumber}` : ''}
                    </p>
                  </div>
                  <span className="tabular shrink-0 text-[13px] font-bold">
                    {payment.amount.formatted}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-6 text-center text-[12.5px] text-ink-dim">—</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
