'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import type { PromotionDTO } from '@storm-tips/types';
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
  TranslationFields,
  translationPayload,
  type Column,
} from '@/components/ui';

export default function PromotionsPage(): ReactNode {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [english, setEnglish] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    ctaLabel: '',
    deepLink: 'stormtips://paywall/COMBO',
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
          translations: translationPayload('en', english),
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
      header: 'Promotion',
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
    {
      key: 'audience',
      header: 'Audience',
      render: (promotion) => <Badge>{promotion.audience}</Badge>,
    },
    {
      key: 'product',
      header: 'Product',
      render: (promotion) => promotion.product ?? <span className="text-ink-dim">—</span>,
    },
    {
      key: 'ends',
      header: 'Ends',
      render: (promotion) =>
        promotion.endsAt ? new Date(promotion.endsAt).toLocaleDateString('en-GB') : 'open-ended',
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
            if (window.confirm('Delete this promotion?')) remove.mutate(promotion.id);
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
        title="Promotions"
        description="Banners in the feed and on the paywalls. Audiences are filtered server-side."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={15} aria-hidden /> New promotion
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
        title="New promotion"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending || form.title.length < 2}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {create.isError ? <ErrorBox error={create.error} /> : null}
          <Field
            label="Title (German)"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
          <Field
            label="Subtitle (German)"
            value={form.subtitle}
            onChange={(event) => setForm({ ...form, subtitle: event.target.value })}
          />
          <TranslationFields
            locale="en"
            title="English version"
            fields={[
              { name: 'title', label: 'Title' },
              { name: 'subtitle', label: 'Subtitle', multiline: true },
              { name: 'ctaLabel', label: 'CTA label' },
            ]}
            value={english}
            onChange={setEnglish}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="CTA label (German)"
              value={form.ctaLabel}
              onChange={(event) => setForm({ ...form, ctaLabel: event.target.value })}
            />
            <Field
              label="Deep link"
              value={form.deepLink}
              onChange={(event) => setForm({ ...form, deepLink: event.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Select
              label="Badge"
              value={form.badge}
              onChange={(event) => setForm({ ...form, badge: event.target.value })}
              options={['NONE', 'MOST_POPULAR', 'LIMITED', 'SALE', 'NEW', 'BEST_VALUE'].map(
                (value) => ({
                  value,
                  label: value,
                }),
              )}
            />
            <Select
              label="Audience"
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
              label="Product"
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
              label="Gradient from"
              type="color"
              value={form.gradientFrom}
              onChange={(event) => setForm({ ...form, gradientFrom: event.target.value })}
            />
            <Field
              label="Gradient to"
              type="color"
              value={form.gradientTo}
              onChange={(event) => setForm({ ...form, gradientTo: event.target.value })}
            />
            <Field
              label="Priority"
              type="number"
              value={form.priority}
              onChange={(event) => setForm({ ...form, priority: event.target.value })}
            />
            <Field
              label="Ends at"
              type="datetime-local"
              value={form.endsAt}
              onChange={(event) => setForm({ ...form, endsAt: event.target.value })}
            />
          </div>
          <Toggle
            label="Active"
            checked={form.isActive}
            onChange={(value) => setForm({ ...form, isActive: value })}
          />
        </div>
      </Modal>
    </>
  );
}
