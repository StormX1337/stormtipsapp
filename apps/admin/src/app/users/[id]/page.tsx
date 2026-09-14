'use client';

import { use, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EntitlementDTO, PaymentDTO, SubscriptionDTO, UserDTO } from '@profit-tips/types';
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
      header: 'Produkt',
      render: (row) => <Badge tone="warning">{row.product}</Badge>,
    },
    {
      key: 'active',
      header: 'Aktiv',
      render: (row) => (
        <Badge tone={row.active ? 'positive' : 'neutral'}>{row.active ? 'JA' : 'NEIN'}</Badge>
      ),
    },
    { key: 'source', header: 'Quelle', render: (row) => row.source },
    {
      key: 'expires',
      header: 'Läuft ab',
      render: (row) =>
        row.expiresAt ? new Date(row.expiresAt).toLocaleString('de-DE') : 'unbefristet',
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) =>
        can('ADMIN') && row.active ? (
          <Button size="sm" variant="danger" onClick={() => revoke.mutate(row.product)}>
            Entziehen
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title={user.displayName ?? user.email}
        description={`${user.email} · registriert ${new Date(user.createdAt).toLocaleDateString('de-DE')}`}
        actions={
          can('ADMIN') ? (
            <>
              <Button variant="outline" onClick={() => setGrantOpen(true)}>
                Zugang gewähren
              </Button>
              <Button variant="ghost" onClick={() => logoutAll.mutate()}>
                Alle Sitzungen beenden
              </Button>
              {user.status === 'BANNED' ? (
                <Button variant="outline" onClick={() => unban.mutate()}>
                  Entsperren
                </Button>
              ) : (
                <Button
                  variant="danger"
                  onClick={() => {
                    const reason = window.prompt('Grund der Sperre?') ?? '';
                    if (reason) ban.mutate(reason);
                  }}
                >
                  Sperren
                </Button>
              )}
            </>
          ) : null
        }
      />

      <section className="mb-4 grid gap-3 sm:grid-cols-4">
        <div className="card px-3 py-3">
          <p className="label">Rolle</p>
          <Badge>{user.role}</Badge>
        </div>
        <div className="card px-3 py-3">
          <p className="label">Status</p>
          <Badge tone={user.status === 'ACTIVE' ? 'positive' : 'negative'}>{user.status}</Badge>
        </div>
        <div className="card px-3 py-3">
          <p className="label">Letzter Login</p>
          <p className="text-[12.5px]">
            {detail.data.lastLoginAt
              ? new Date(detail.data.lastLoginAt).toLocaleString('de-DE')
              : '—'}
          </p>
        </div>
        <div className="card px-3 py-3">
          <p className="label">Empfehlungen</p>
          <p className="tabular text-[16px] font-bold">{detail.data.referralCount}</p>
        </div>
      </section>

      <h2 className="mb-2 text-[14px] font-bold">Zugänge</h2>
      <DataTable
        columns={entitlementColumns}
        rows={user.entitlements}
        rowKey={(row) => `${row.product}-${row.source}-${row.expiresAt ?? 'none'}`}
        empty="Keine Zugänge"
      />

      <h2 className="mt-5 mb-2 text-[14px] font-bold">Abonnements</h2>
      <DataTable
        columns={[
          {
            key: 'plan',
            header: 'Tarif',
            render: (row) => row.plan?.name ?? row.products.join(' + '),
          },
          { key: 'provider', header: 'Anbieter', render: (row) => <Badge>{row.provider}</Badge> },
          {
            key: 'status',
            header: 'Status',
            render: (row) => (
              <Badge tone={row.status === 'ACTIVE' ? 'positive' : 'neutral'}>{row.status}</Badge>
            ),
          },
          {
            key: 'end',
            header: 'Periode bis',
            render: (row) =>
              row.currentPeriodEnd
                ? new Date(row.currentPeriodEnd).toLocaleDateString('de-DE')
                : '—',
          },
        ]}
        rows={subscriptions}
        rowKey={(row) => row.id}
        empty="Keine Abonnements"
      />

      <h2 className="mt-5 mb-2 text-[14px] font-bold">Zahlungen</h2>
      <DataTable
        columns={[
          { key: 'desc', header: 'Beschreibung', render: (row) => row.description ?? row.provider },
          {
            key: 'amount',
            header: 'Betrag',
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
            header: 'Datum',
            align: 'right',
            render: (row) =>
              row.paidAt
                ? new Date(row.paidAt).toLocaleString('de-DE')
                : new Date(row.createdAt).toLocaleString('de-DE'),
          },
        ]}
        rows={payments}
        rowKey={(row) => row.id}
        empty="Keine Zahlungen"
      />

      <h2 className="mt-5 mb-2 text-[14px] font-bold">Aktive Sitzungen</h2>
      <DataTable
        columns={[
          { key: 'ip', header: 'IP', render: (row) => row.ip ?? '—' },
          {
            key: 'ua',
            header: 'Gerät',
            render: (row) => (
              <span className="text-ink-dim">{row.userAgent?.slice(0, 70) ?? '—'}</span>
            ),
          },
          {
            key: 'last',
            header: 'Zuletzt',
            align: 'right',
            render: (row) => new Date(row.lastUsedAt).toLocaleString('de-DE'),
          },
        ]}
        rows={sessions}
        rowKey={(row) => row.id}
        empty="Keine aktiven Sitzungen"
      />

      <Modal
        open={grantOpen}
        onClose={() => setGrantOpen(false)}
        title="Zugang gewähren"
        footer={
          <>
            <Button variant="ghost" onClick={() => setGrantOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={() => grant.mutate()} disabled={grant.isPending}>
              Gewähren
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {grant.isError ? <ErrorBox error={grant.error} /> : null}
          <Select
            label="Produkt"
            value={grantProduct}
            onChange={(event) => setGrantProduct(event.target.value)}
            options={['VIP', 'EXTRA', 'COMBO', 'FIX_ODDS'].map((value) => ({
              value,
              label: value,
            }))}
          />
          <Field
            label="Dauer in Tagen"
            type="number"
            min="1"
            value={grantDays}
            onChange={(event) => setGrantDays(event.target.value)}
          />
          <Field
            label="Notiz"
            value={grantNote}
            onChange={(event) => setGrantNote(event.target.value)}
            placeholder="Grund der manuellen Freischaltung"
          />
        </div>
      </Modal>
    </>
  );
}
