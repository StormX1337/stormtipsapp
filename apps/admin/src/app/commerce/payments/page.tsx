'use client';

import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Paginated, PaymentDTO } from '@profit-tips/types';
import { api } from '@/lib/api';
import { Badge, DataTable, ErrorBox, PageHeader, Pagination, type Column } from '@/components/ui';

type PaymentRow = PaymentDTO & { userEmail: string };

export default function PaymentsPage(): ReactNode {
  const [page, setPage] = useState(1);

  const payments = useQuery({
    queryKey: ['admin-payments', page],
    queryFn: () =>
      api<Paginated<PaymentRow> & { totalRevenueCents: number }>(
        `/admin/commerce/payments?page=${page}&limit=25`,
      ),
  });

  const columns: Column<PaymentRow>[] = [
    { key: 'user', header: 'Nutzer', render: (row) => row.userEmail },
    {
      key: 'desc',
      header: 'Beschreibung',
      render: (row) => (
        <div>
          <p>{row.description ?? '—'}</p>
          <p className="text-[11px] text-ink-dim">{row.invoiceNumber ?? ''}</p>
        </div>
      ),
    },
    { key: 'provider', header: 'Anbieter', render: (row) => <Badge>{row.provider}</Badge> },
    {
      key: 'amount',
      header: 'Betrag',
      align: 'right',
      render: (row) => <span className="tabular font-bold">{row.amount.formatted}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge
          tone={
            row.status === 'SUCCEEDED'
              ? 'positive'
              : row.status === 'REFUNDED' || row.status === 'PARTIALLY_REFUNDED'
                ? 'warning'
                : 'negative'
          }
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'date',
      header: 'Datum',
      align: 'right',
      render: (row) =>
        new Date(row.paidAt ?? row.createdAt).toLocaleString('de-DE', {
          dateStyle: 'short',
          timeStyle: 'short',
        }),
    },
  ];

  return (
    <>
      <PageHeader
        title="Zahlungen"
        description={
          payments.data
            ? `Gesamtumsatz: ${(payments.data.totalRevenueCents / 100).toLocaleString('de-DE', {
                style: 'currency',
                currency: 'EUR',
              })}`
            : 'Alle erfolgreichen und fehlgeschlagenen Transaktionen.'
        }
      />

      {payments.isError ? <ErrorBox error={payments.error} /> : null}

      <DataTable
        columns={columns}
        rows={payments.data?.items ?? []}
        loading={payments.isPending}
        rowKey={(row) => row.id}
      />

      {payments.data ? (
        <Pagination
          page={payments.data.page}
          totalPages={payments.data.totalPages}
          onChange={setPage}
        />
      ) : null}
    </>
  );
}
