'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import type { Paginated } from '@profit-tips/types';
import { api } from '@/lib/api';
import {
  Badge,
  Button,
  DataTable,
  ErrorBox,
  Field,
  PageHeader,
  Select,
  TextArea,
  Toggle,
  type Column,
} from '@/components/ui';

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  status: string;
  createdAt: string;
  sentAt: string | null;
}

interface DeviceStat {
  platform: string;
  provider: string;
  isActive: boolean;
  count: number;
}

export default function NotificationsPage(): ReactNode {
  const [form, setForm] = useState({
    type: 'SYSTEM',
    title: '',
    body: '',
    deepLink: '',
    products: [] as string[],
    onlyFreeUsers: false,
    scheduledAt: '',
  });

  const history = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: () => api<Paginated<NotificationRow>>('/admin/ops/notifications?limit=25'),
  });

  const devices = useQuery({
    queryKey: ['admin-devices'],
    queryFn: () => api<{ items: DeviceStat[] }>('/admin/ops/notifications/devices'),
  });

  const send = useMutation({
    mutationFn: () =>
      api<{ queued: boolean; estimatedRecipients: number }>('/admin/ops/notifications/send', {
        method: 'POST',
        body: {
          type: form.type,
          title: form.title,
          body: form.body,
          deepLink: form.deepLink || null,
          audience: {
            products: form.products.length > 0 ? form.products : undefined,
            onlyFreeUsers: form.onlyFreeUsers || undefined,
          },
          scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
        },
      }),
    onSuccess: () => {
      void history.refetch();
      setForm({ ...form, title: '', body: '' });
    },
  });

  const columns: Column<NotificationRow>[] = [
    {
      key: 'title',
      header: 'Mitteilung',
      render: (row) => (
        <div>
          <p className="font-medium">{row.title}</p>
          <p className="text-[11px] text-ink-dim">{row.body}</p>
        </div>
      ),
    },
    { key: 'type', header: 'Typ', render: (row) => <Badge>{row.type}</Badge> },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.status === 'SENT' ? 'positive' : row.status === 'FAILED' ? 'negative' : 'neutral'}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'sent',
      header: 'Gesendet',
      align: 'right',
      render: (row) =>
        row.sentAt
          ? new Date(row.sentAt).toLocaleString('de-DE')
          : new Date(row.createdAt).toLocaleString('de-DE'),
    },
  ];

  return (
    <>
      <PageHeader
        title="Push-Mitteilungen"
        description="Die Zustellung übernimmt der Worker; Nutzer ohne Einwilligung für diesen Typ werden automatisch übersprungen."
      />

      <section className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="card p-4">
          <h2 className="mb-3 text-[14px] font-bold">Neue Mitteilung</h2>
          <div className="flex flex-col gap-3">
            {send.isError ? <ErrorBox error={send.error} /> : null}
            {send.isSuccess ? (
              <p className="rounded-sm bg-accent-500/10 px-3 py-2 text-[12px] text-accent-300">
                Eingereiht — geschätzte Empfänger: {send.data.estimatedRecipients}
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Typ"
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value })}
                options={['SYSTEM', 'PROMOTION', 'NEW_TIP', 'NEW_VIP_TIP', 'NEW_COMBO', 'POLL'].map(
                  (value) => ({ value, label: value }),
                )}
              />
              <Field
                label="Geplant für"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })}
              />
            </div>

            <Field
              label="Titel"
              maxLength={80}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
            <TextArea
              label="Text"
              maxLength={240}
              value={form.body}
              onChange={(event) => setForm({ ...form, body: event.target.value })}
            />
            <Field
              label="Deep-Link"
              value={form.deepLink}
              onChange={(event) => setForm({ ...form, deepLink: event.target.value })}
              placeholder="profittips://combo"
            />

            <div>
              <span className="label">Zielgruppe (leer = alle mit passender Einwilligung)</span>
              <div className="flex flex-wrap gap-3">
                {['VIP', 'EXTRA', 'COMBO', 'FIX_ODDS'].map((product) => (
                  <Toggle
                    key={product}
                    label={product}
                    checked={form.products.includes(product)}
                    onChange={(checked) =>
                      setForm({
                        ...form,
                        products: checked
                          ? [...form.products, product]
                          : form.products.filter((value) => value !== product),
                      })
                    }
                  />
                ))}
                <Toggle
                  label="Nur Free-Nutzer"
                  checked={form.onlyFreeUsers}
                  onChange={(value) => setForm({ ...form, onlyFreeUsers: value })}
                />
              </div>
            </div>

            <Button
              onClick={() => send.mutate()}
              disabled={send.isPending || form.title.length < 2 || form.body.length < 2}
            >
              <Send size={15} aria-hidden /> Senden
            </Button>

            <p className="text-[11px] text-ink-dim">
              Kein Versprechen garantierter Gewinne — Mitteilungen unterliegen denselben Regeln wie
              die App-Texte.
            </p>
          </div>
        </div>

        <div className="card p-4">
          <h2 className="mb-3 text-[14px] font-bold">Registrierte Geräte</h2>
          {devices.isPending ? (
            <p className="text-[12px] text-ink-dim">Wird geladen…</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(devices.data?.items ?? []).map((stat) => (
                <li
                  key={`${stat.platform}-${stat.provider}-${String(stat.isActive)}`}
                  className="flex items-center justify-between text-[12px]"
                >
                  <span className="text-ink-muted">
                    {stat.platform} · {stat.provider}
                    {stat.isActive ? '' : ' (inaktiv)'}
                  </span>
                  <span className="tabular font-bold">{stat.count}</span>
                </li>
              ))}
              {(devices.data?.items ?? []).length === 0 ? (
                <li className="text-[12px] text-ink-dim">Noch keine Geräte registriert.</li>
              ) : null}
            </ul>
          )}
        </div>
      </section>

      <h2 className="mb-2 text-[14px] font-bold">Verlauf</h2>
      <DataTable
        columns={columns}
        rows={history.data?.items ?? []}
        loading={history.isPending}
        rowKey={(row) => row.id}
      />
    </>
  );
}
