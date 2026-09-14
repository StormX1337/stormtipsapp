'use client';

import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Paginated, PaymentDTO } from '@storm-tips/types';
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
    { key: 'user', header: 'User', render: (row) => row.userEmail },
    {
      key: 'desc',
      header: 'Description',
      render: (row) => (
        <div>
          <p>{row.description ?? '—'}</p>
          <p className="text-[11px] text-ink-dim">{row.invoiceNumber ?? ''}</p>
        </div>
      ),
    },
    { key: 'provider', header: 'Provider', render: (row) => <Badge>{row.provider}</Badge> },
    {
      key: 'amount',
      header: 'Amount',
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
      header: 'Date',
      align: 'right',
      render: (row) =>
        new Date(row.paidAt ?? row.createdAt).toLocaleString('en-GB', {
          dateStyle: 'short',
          timeStyle: 'short',
        }),
    },
  ];

  return (
    <>
      <PageHeader
        title="Payments"
        description={
          payments.data
            ? `Total revenue: ${(payments.data.totalRevenueCents / 100).toLocaleString('en-GB', {
                style: 'currency',
                currency: 'EUR',
              })}`
            : 'Every successful and failed transaction.'
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
