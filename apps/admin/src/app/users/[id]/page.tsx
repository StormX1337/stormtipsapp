'use client';

import { use, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EntitlementDTO, PaymentDTO, SubscriptionDTO, UserDTO } from '@storm-tips/types';
import { api } from '@/lib/api';
import { useAdminAuth } from '@/lib/auth';
import {
  Badge,
  Button,
  DataTable,
  ErrorBox,
  Field,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  type Column,
} from '@/components/ui';

interface UserDetail {
  user: UserDTO;
  subscriptions: SubscriptionDTO[];
  payments: PaymentDTO[];
  sessions: { id: string; ip: string | null; userAgent: string | null; lastUsedAt: string }[];
  referralCount: number;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
}

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }): ReactNode {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { can } = useAdminAuth();
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantProduct, setGrantProduct] = useState('VIP');
  const [grantDays, setGrantDays] = useState('30');
  const [grantNote, setGrantNote] = useState('');

  const detail = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => api<UserDetail>(`/admin/users/${id}`),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin-user', id] });
  };

  const grant = useMutation({
    mutationFn: () =>
      api(`/admin/users/${id}/entitlements`, {
        method: 'POST',
        body: { product: grantProduct, days: Number(grantDays), note: grantNote || undefined },
      }),
    onSuccess: () => {
      invalidate();
      setGrantOpen(false);
    },
  });

  const revoke = useMutation({
    mutationFn: (product: string) =>
      api(`/admin/users/${id}/entitlements`, { method: 'DELETE', body: { product } }),
    onSuccess: invalidate,
  });

  const ban = useMutation({
    mutationFn: (reason: string) =>
      api(`/admin/users/${id}/ban`, { method: 'POST', body: { banReason: reason } }),
    onSuccess: invalidate,
  });

  const unban = useMutation({
    mutationFn: () => api(`/admin/users/${id}/unban`, { method: 'POST' }),
    onSuccess: invalidate,
  });

  const logoutAll = useMutation({
    mutationFn: () => api(`/admin/users/${id}/logout-all`, { method: 'POST' }),
    onSuccess: invalidate,
  });

  if (detail.isPending) return <Skeleton className="h-64 w-full" />;
  if (detail.isError) return <ErrorBox error={detail.error} />;

  const { user, subscriptions, payments, sessions } = detail.data;

  const entitlementColumns: Column<EntitlementDTO>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (row) => <Badge tone="warning">{row.product}</Badge>,
    },
    {
      key: 'active',
      header: 'Active',
      render: (row) => (
        <Badge tone={row.active ? 'positive' : 'neutral'}>{row.active ? 'YES' : 'NO'}</Badge>
      ),
    },
    { key: 'source', header: 'Source', render: (row) => row.source },
    {
      key: 'expires',
      header: 'Expires',
      render: (row) =>
        row.expiresAt ? new Date(row.expiresAt).toLocaleString('en-GB') : 'open-ended',
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) =>
        can('ADMIN') && row.active ? (
          <Button size="sm" variant="danger" onClick={() => revoke.mutate(row.product)}>
            Revoke
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title={user.displayName ?? user.email}
        description={`${user.email} · signed up ${new Date(user.createdAt).toLocaleDateString('en-GB')}`}
        actions={
          can('ADMIN') ? (
            <>
              <Button variant="outline" onClick={() => setGrantOpen(true)}>
                Grant access
              </Button>
              <Button variant="ghost" onClick={() => logoutAll.mutate()}>
                End all sessions
              </Button>
              {user.status === 'BANNED' ? (
                <Button variant="outline" onClick={() => unban.mutate()}>
                  Unsuspend
                </Button>
              ) : (
                <Button
                  variant="danger"
                  onClick={() => {
                    const reason = window.prompt('Reason for the suspension?') ?? '';
                    if (reason) ban.mutate(reason);
                  }}
                >
                  Suspend
                </Button>
              )}
            </>
          ) : null
        }
      />

      <section className="mb-4 grid gap-3 sm:grid-cols-4">
        <div className="card px-3 py-3">
          <p className="label">Role</p>
          <Badge>{user.role}</Badge>
        </div>
        <div className="card px-3 py-3">
          <p className="label">Status</p>
          <Badge tone={user.status === 'ACTIVE' ? 'positive' : 'negative'}>{user.status}</Badge>
        </div>
        <div className="card px-3 py-3">
          <p className="label">Last sign-in</p>
          <p className="text-[12.5px]">
            {detail.data.lastLoginAt
              ? new Date(detail.data.lastLoginAt).toLocaleString('en-GB')
              : '—'}
          </p>
        </div>
        <div className="card px-3 py-3">
          <p className="label">Referrals</p>
          <p className="tabular text-[16px] font-bold">{detail.data.referralCount}</p>
        </div>
      </section>

      <h2 className="mb-2 text-[14px] font-bold">Entitlements</h2>
      <DataTable
        columns={entitlementColumns}
        rows={user.entitlements}
        rowKey={(row) => `${row.product}-${row.source}-${row.expiresAt ?? 'none'}`}
        empty="No entitlements"
      />

      <h2 className="mt-5 mb-2 text-[14px] font-bold">Subscriptions</h2>
      <DataTable
        columns={[
          {
            key: 'plan',
            header: 'Plan',
            render: (row) => row.plan?.name ?? row.products.join(' + '),
          },
          { key: 'provider', header: 'Provider', render: (row) => <Badge>{row.provider}</Badge> },
          {
            key: 'status',
            header: 'Status',
            render: (row) => (
              <Badge tone={row.status === 'ACTIVE' ? 'positive' : 'neutral'}>{row.status}</Badge>
            ),
          },
          {
            key: 'end',
            header: 'Period ends',
            render: (row) =>
              row.currentPeriodEnd
                ? new Date(row.currentPeriodEnd).toLocaleDateString('en-GB')
                : '—',
          },
        ]}
        rows={subscriptions}
        rowKey={(row) => row.id}
        empty="No subscriptions"
      />

      <h2 className="mt-5 mb-2 text-[14px] font-bold">Payments</h2>
      <DataTable
        columns={[
          { key: 'desc', header: 'Description', render: (row) => row.description ?? row.provider },
          {
            key: 'amount',
            header: 'Amount',
            align: 'right',
            render: (row) => <span className="tabular">{row.amount.formatted}</span>,
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => (
              <Badge tone={row.status === 'SUCCEEDED' ? 'positive' : 'negative'}>
                {row.status}
              </Badge>
            ),
          },
          {
            key: 'date',
            header: 'Date',
            align: 'right',
            render: (row) =>
              row.paidAt
                ? new Date(row.paidAt).toLocaleString('en-GB')
                : new Date(row.createdAt).toLocaleString('en-GB'),
          },
        ]}
        rows={payments}
        rowKey={(row) => row.id}
        empty="No payments"
      />

      <h2 className="mt-5 mb-2 text-[14px] font-bold">Active sessions</h2>
      <DataTable
        columns={[
          { key: 'ip', header: 'IP', render: (row) => row.ip ?? '—' },
          {
            key: 'ua',
            header: 'Device',
            render: (row) => (
              <span className="text-ink-dim">{row.userAgent?.slice(0, 70) ?? '—'}</span>
            ),
          },
          {
            key: 'last',
            header: 'Last used',
            align: 'right',
            render: (row) => new Date(row.lastUsedAt).toLocaleString('en-GB'),
          },
        ]}
        rows={sessions}
        rowKey={(row) => row.id}
        empty="No active sessions"
      />

      <Modal
        open={grantOpen}
        onClose={() => setGrantOpen(false)}
        title="Grant access"
        footer={
          <>
            <Button variant="ghost" onClick={() => setGrantOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => grant.mutate()} disabled={grant.isPending}>
              Grant
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {grant.isError ? <ErrorBox error={grant.error} /> : null}
          <Select
            label="Product"
            value={grantProduct}
            onChange={(event) => setGrantProduct(event.target.value)}
            options={['VIP', 'EXTRA', 'COMBO', 'FIX_ODDS'].map((value) => ({
              value,
              label: value,
            }))}
          />
          <Field
            label="Duration in days"
            type="number"
            min="1"
            value={grantDays}
            onChange={(event) => setGrantDays(event.target.value)}
          />
          <Field
            label="Note"
            value={grantNote}
            onChange={(event) => setGrantNote(event.target.value)}
            placeholder="Why this access was granted manually"
          />
        </div>
      </Modal>
    </>
  );
}
