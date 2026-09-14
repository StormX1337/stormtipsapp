'use client';

import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Paginated, SubscriptionDTO } from '@profit-tips/types';
import { api } from '@/lib/api';
import {
  Badge,
  DataTable,
  ErrorBox,
  PageHeader,
  Pagination,
  type Column,
} from '@/components/ui';

type SubscriptionRow = SubscriptionDTO & { userEmail: string };

interface WebhookRow {
  id: string;
  provider: string;
  eventId: string;
  type: string;
  status: string;
  error: string | null;
  attempts: number;
  receivedAt: string;
}

export default function SubscriptionsPage(): ReactNode {
  const [page, setPage] = useState(1);

  const subscriptions = useQuery({
    queryKey: ['admin-subscriptions', page],
    queryFn: () =>
      api<Paginated<SubscriptionRow>>(`/admin/commerce/subscriptions?page=${page}&limit=25`),
  });

  const webhooks = useQuery({
    queryKey: ['admin-webhooks'],
    queryFn: () => api<Paginated<WebhookRow>>('/admin/commerce/webhooks?limit=15'),
  });

  const columns: Column<SubscriptionRow>[] = [
    { key: 'user', header: 'Nutzer', render: (row) => row.userEmail },
    { key: 'plan', header: 'Tarif', render: (row) => row.plan?.name ?? row.products.join(' + ') },
    { key: 'provider', header: 'Anbieter', render: (row) => <Badge>{row.provider}</Badge> },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge
          tone={
            row.status === 'ACTIVE' || row.status === 'TRIALING'
              ? 'positive'
              : row.status === 'EXPIRED'
                ? 'neutral'
                : 'warning'
          }
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'renew',
      header: 'Verlängert',
      render: (row) => (row.willRenew ? 'ja' : 'nein'),
    },
    {
      key: 'end',
      header: 'Periode bis',
      align: 'right',
      render: (row) =>
        row.currentPeriodEnd ? new Date(row.currentPeriodEnd).toLocaleDateString('de-DE') : '—',
    },
  ];

  return (
    <>
      <PageHeader title="Abonnements" description="Alle Abos über Stripe, Apple und Google." />

      {subscriptions.isError ? <ErrorBox error={subscriptions.error} /> : null}

      <DataTable
        columns={columns}
        rows={subscriptions.data?.items ?? []}
        loading={subscriptions.isPending}
        rowKey={(row) => row.id}
      />

      {subscriptions.data ? (
        <Pagination
          page={subscriptions.data.page}
          totalPages={subscriptions.data.totalPages}
          onChange={setPage}
        />
      ) : null}

      <h2 className="mt-6 mb-2 text-[14px] font-bold">Letzte Webhooks</h2>
      <p className="mb-2 text-[12px] text-ink-muted">
        Jedes Ereignis wird vor der Verarbeitung erfasst; ein erneuter Zustellversuch wird dadurch
        wirkungslos.
      </p>
      <DataTable
        columns={[
          { key: 'provider', header: 'Anbieter', render: (row) => <Badge>{row.provider}</Badge> },
          { key: 'type', header: 'Typ', render: (row) => row.type },
          {
            key: 'status',
            header: 'Status',
            render: (row) => (
              <Badge tone={row.status === 'PROCESSED' ? 'positive' : row.status === 'FAILED' ? 'negative' : 'neutral'}>
                {row.status}
              </Badge>
            ),
          },
          { key: 'attempts', header: 'Versuche', align: 'right', render: (row) => row.attempts },
          {
            key: 'error',
            header: 'Fehler',
            render: (row) => <span className="text-[11px] text-lost">{row.error?.slice(0, 80) ?? ''}</span>,
          },
          {
            key: 'received',
            header: 'Empfangen',
            align: 'right',
            render: (row) => new Date(row.receivedAt).toLocaleString('de-DE'),
          },
        ]}
        rows={webhooks.data?.items ?? []}
        loading={webhooks.isPending}
        rowKey={(row) => row.id}
        empty="Noch keine Webhooks empfangen"
      />
    </>
  );
}
