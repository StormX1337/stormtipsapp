'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { Paginated, UserDTO } from '@profit-tips/types';
import { api } from '@/lib/api';
import {
  Badge,
  DataTable,
  ErrorBox,
  PageHeader,
  Pagination,
  Select,
  type Column,
} from '@/components/ui';

type AdminUserRow = UserDTO & {
  counts: { subscriptions: number; payments: number; referralsMade: number };
  lastLoginAt: string | null;
};

export default function UsersPage(): ReactNode {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [product, setProduct] = useState('');

  const params = new URLSearchParams({ page: String(page), limit: '25' });
  if (search) params.set('search', search);
  if (role) params.set('role', role);
  if (status) params.set('status', status);
  if (product) params.set('product', product);

  const users = useQuery({
    queryKey: ['admin-users', params.toString()],
    queryFn: () => api<Paginated<AdminUserRow>>(`/admin/users?${params.toString()}`),
  });

  const columns: Column<AdminUserRow>[] = [
    {
      key: 'user',
      header: 'Nutzer',
      render: (user) => (
        <Link href={`/users/${user.id}`} className="block hover:text-accent-500">
          <p className="font-medium">{user.displayName ?? '—'}</p>
          <p className="text-[11px] text-ink-dim">{user.email}</p>
        </Link>
      ),
    },
    { key: 'role', header: 'Rolle', render: (user) => <Badge>{user.role}</Badge> },
    {
      key: 'status',
      header: 'Status',
      render: (user) => (
        <Badge tone={user.status === 'ACTIVE' ? 'positive' : user.status === 'BANNED' ? 'negative' : 'neutral'}>
          {user.status}
        </Badge>
      ),
    },
    {
      key: 'products',
      header: 'Produkte',
      render: (user) => (
        <div className="flex flex-wrap gap-1">
          {user.entitlements.filter((entitlement) => entitlement.active).length === 0 ? (
            <span className="text-ink-dim">—</span>
          ) : (
            user.entitlements
              .filter((entitlement) => entitlement.active)
              .map((entitlement) => (
                <Badge key={entitlement.product} tone="warning">
                  {entitlement.product}
                </Badge>
              ))
          )}
        </div>
      ),
    },
    {
      key: 'counts',
      header: 'Abos / Zahlungen',
      align: 'right',
      render: (user) => (
        <span className="tabular text-ink-muted">
          {user.counts.subscriptions} / {user.counts.payments}
        </span>
      ),
    },
    {
      key: 'created',
      header: 'Registriert',
      align: 'right',
      render: (user) => (
        <span className="text-ink-dim">
          {new Date(user.createdAt).toLocaleDateString('de-DE')}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Nutzer" description="Konten suchen, prüfen, sperren und Zugänge vergeben." />

      <div className="mb-3 grid gap-2 sm:grid-cols-4">
        <label className="block">
          <span className="label">Suche</span>
          <input
            className="input"
            placeholder="E-Mail, Name, Code"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <Select
          label="Rolle"
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'Alle' },
            ...['USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'].map((value) => ({ value, label: value })),
          ]}
        />
        <Select
          label="Status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'Alle' },
            ...['ACTIVE', 'PENDING_VERIFICATION', 'BANNED', 'DELETED'].map((value) => ({
              value,
              label: value,
            })),
          ]}
        />
        <Select
          label="Produkt"
          value={product}
          onChange={(event) => {
            setProduct(event.target.value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'Alle' },
            ...['VIP', 'EXTRA', 'COMBO', 'FIX_ODDS'].map((value) => ({ value, label: value })),
          ]}
        />
      </div>

      {users.isError ? <ErrorBox error={users.error} /> : null}

      <DataTable
        columns={columns}
        rows={users.data?.items ?? []}
        loading={users.isPending}
        rowKey={(user) => user.id}
      />

      {users.data ? (
        <Pagination page={users.data.page} totalPages={users.data.totalPages} onChange={setPage} />
      ) : null}
    </>
  );
}
