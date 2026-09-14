'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import type { PromotionDTO } from '@profit-tips/types';
import { api } from '@/lib/api';
import {
  Badge,
  Button,
  DataTable,
  ErrorBox,
  Field,
  Modal,
  PageHeader,
  Select,
  Toggle,
  type Column,
} from '@/components/ui';

export default function PromotionsPage(): ReactNode {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    ctaLabel: '',
    deepLink: 'profittips://paywall/COMBO',
    badge: 'NONE',
    audience: 'ALL',
    product: '',
    gradientFrom: '#2B1B5E',
    gradientTo: '#8B5CF6',
    endsAt: '',
    priority: '100',
    isActive: true,
  });

  const promotions = useQuery({
    queryKey: ['admin-promotions'],
    queryFn: () => api<{ items: PromotionDTO[] }>('/admin/commerce/promotions'),
  });

  const create = useMutation({
    mutationFn: () =>
      api('/admin/commerce/promotions', {
        method: 'POST',
        body: {
          title: form.title,
          subtitle: form.subtitle || null,
          ctaLabel: form.ctaLabel || null,
          deepLink: form.deepLink || null,
          badge: form.badge,
          audience: form.audience,
          product: form.product || null,
          gradientFrom: form.gradientFrom,
          gradientTo: form.gradientTo,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
          priority: Number(form.priority),
          isActive: form.isActive,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
      setOpen(false);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/commerce/promotions/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-promotions'] }),
  });

  const columns: Column<PromotionDTO>[] = [
    {
      key: 'title',
      header: 'Aktion',
      render: (promotion) => (
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="h-8 w-8 shrink-0 rounded-sm"
            style={{
              background: `linear-gradient(135deg, ${promotion.gradientFrom ?? '#2A3140'}, ${
                promotion.gradientTo ?? '#141821'
              })`,
            }}
          />
          <div>
            <p className="font-medium">{promotion.title}</p>
            <p className="text-[11px] text-ink-dim">{promotion.subtitle ?? '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'badge',
      header: 'Badge',
      render: (promotion) =>
        promotion.badge === 'NONE' ? '—' : <Badge tone="info">{promotion.badge}</Badge>,
    },
    { key: 'audience', header: 'Zielgruppe', render: (promotion) => <Badge>{promotion.audience}</Badge> },
    {
      key: 'product',
      header: 'Produkt',
      render: (promotion) => promotion.product ?? <span className="text-ink-dim">—</span>,
    },
    {
      key: 'ends',
      header: 'Endet',
      render: (promotion) =>
        promotion.endsAt ? new Date(promotion.endsAt).toLocaleDateString('de-DE') : 'unbefristet',
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (promotion) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (window.confirm('Aktion löschen?')) remove.mutate(promotion.id);
          }}
        >
          <Trash2 size={14} aria-hidden />
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Aktionen"
        description="Werbebanner im Feed und auf den Paywalls. Zielgruppen werden serverseitig gefiltert."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={15} aria-hidden /> Neue Aktion
          </Button>
        }
      />

      {promotions.isError ? <ErrorBox error={promotions.error} /> : null}

      <DataTable
        columns={columns}
        rows={promotions.data?.items ?? []}
        loading={promotions.isPending}
        rowKey={(promotion) => promotion.id}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        wide
        title="Neue Aktion"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || form.title.length < 2}>
              Anlegen
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {create.isError ? <ErrorBox error={create.error} /> : null}
          <Field
            label="Titel"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
          <Field
            label="Untertitel"
            value={form.subtitle}
            onChange={(event) => setForm({ ...form, subtitle: event.target.value })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Button-Text"
              value={form.ctaLabel}
              onChange={(event) => setForm({ ...form, ctaLabel: event.target.value })}
            />
            <Field
              label="Deep-Link"
              value={form.deepLink}
              onChange={(event) => setForm({ ...form, deepLink: event.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Select
              label="Badge"
              value={form.badge}
              onChange={(event) => setForm({ ...form, badge: event.target.value })}
              options={['NONE', 'MOST_POPULAR', 'LIMITED', 'SALE', 'NEW', 'BEST_VALUE'].map((value) => ({
                value,
                label: value,
              }))}
            />
            <Select
              label="Zielgruppe"
              value={form.audience}
              onChange={(event) => setForm({ ...form, audience: event.target.value })}
              options={[
                'ALL',
                'ANONYMOUS',
                'FREE_USERS',
                'SUBSCRIBERS',
                'EXPIRING_SUBSCRIBERS',
                'CHURNED',
              ].map((value) => ({ value, label: value }))}
            />
            <Select
              label="Produkt"
              value={form.product}
              onChange={(event) => setForm({ ...form, product: event.target.value })}
              options={[
                { value: '', label: '—' },
                ...['VIP', 'EXTRA', 'COMBO', 'FIX_ODDS'].map((value) => ({ value, label: value })),
              ]}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field
              label="Farbverlauf von"
              type="color"
              value={form.gradientFrom}
              onChange={(event) => setForm({ ...form, gradientFrom: event.target.value })}
            />
            <Field
              label="Farbverlauf bis"
              type="color"
              value={form.gradientTo}
              onChange={(event) => setForm({ ...form, gradientTo: event.target.value })}
            />
            <Field
              label="Priorität"
              type="number"
              value={form.priority}
              onChange={(event) => setForm({ ...form, priority: event.target.value })}
            />
            <Field
              label="Endet am"
              type="datetime-local"
              value={form.endsAt}
              onChange={(event) => setForm({ ...form, endsAt: event.target.value })}
            />
          </div>
          <Toggle
            label="Aktiv"
            checked={form.isActive}
            onChange={(value) => setForm({ ...form, isActive: value })}
          />
        </div>
      </Modal>
    </>
  );
}
