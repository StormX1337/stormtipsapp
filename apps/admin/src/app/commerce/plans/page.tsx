'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { ProductCode, SubscriptionPlanDTO } from '@storm-tips/types';
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

const PRODUCTS: ProductCode[] = ['VIP', 'EXTRA', 'COMBO', 'FIX_ODDS'];
const BADGES = ['NONE', 'MOST_POPULAR', 'LIMITED', 'SALE', 'NEW', 'BEST_VALUE'];

interface PlanForm {
  id?: string;
  slug: string;
  name: string;
  description: string;
  products: ProductCode[];
  price: string;
  compareAtPrice: string;
  interval: string;
  intervalCount: string;
  trialDays: string;
  badge: string;
  highlight: string;
  isPopular: boolean;
  isActive: boolean;
  sortOrder: string;
  stripePriceId: string;
  appleProductId: string;
  googleProductId: string;
}

const EMPTY: PlanForm = {
  slug: '',
  name: '',
  description: '',
  products: ['COMBO'],
  price: '29.99',
  compareAtPrice: '',
  interval: 'MONTH',
  intervalCount: '1',
  trialDays: '0',
  badge: 'NONE',
  highlight: '',
  isPopular: false,
  isActive: true,
  sortOrder: '0',
  stripePriceId: '',
  appleProductId: '',
  googleProductId: '',
};

export default function PlansPage(): ReactNode {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PlanForm>(EMPTY);

  const plans = useQuery({
    queryKey: ['admin-plans'],
    queryFn: () => api<{ items: SubscriptionPlanDTO[] }>('/admin/commerce/plans'),
  });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        slug: form.slug,
        name: form.name,
        description: form.description || null,
        products: form.products,
        priceCents: Math.round(Number(form.price) * 100),
        compareAtPriceCents: form.compareAtPrice
          ? Math.round(Number(form.compareAtPrice) * 100)
          : null,
        currency: 'EUR',
        interval: form.interval,
        intervalCount: Number(form.intervalCount),
        trialDays: Number(form.trialDays),
        badge: form.badge,
        highlight: form.highlight || null,
        isPopular: form.isPopular,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder),
        stripePriceId: form.stripePriceId || null,
        appleProductId: form.appleProductId || null,
        googleProductId: form.googleProductId || null,
      };
      return form.id
        ? api(`/admin/commerce/plans/${form.id}`, { method: 'PATCH', body })
        : api('/admin/commerce/plans', { method: 'POST', body });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      setOpen(false);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/commerce/plans/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-plans'] }),
  });

  const columns: Column<SubscriptionPlanDTO>[] = [
    {
      key: 'name',
      header: 'Tarif',
      render: (plan) => (
        <div>
          <p className="font-medium">{plan.name}</p>
          <p className="text-[11px] text-ink-dim">{plan.slug}</p>
        </div>
      ),
    },
    {
      key: 'products',
      header: 'Produkte',
      render: (plan) => (
        <div className="flex flex-wrap gap-1">
          {plan.products.map((product) => (
            <Badge key={product} tone="warning">
              {product}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Preis',
      align: 'right',
      render: (plan) => (
        <div>
          <p className="tabular font-bold">{plan.price.formatted}</p>
          {plan.pricePerMonth ? (
            <p className="text-[11px] text-ink-dim">{plan.pricePerMonth.formatted}/Monat</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'duration',
      header: 'Laufzeit',
      render: (plan) => `${plan.intervalCount} × ${plan.interval}`,
    },
    {
      key: 'badge',
      header: 'Badge',
      render: (plan) => (plan.badge === 'NONE' ? '—' : <Badge tone="info">{plan.badge}</Badge>),
    },
    {
      key: 'store',
      header: 'Store-IDs',
      render: (plan) => (
        <div className="text-[11px] text-ink-dim">
          <p>{plan.stripePriceId ?? 'stripe: —'}</p>
          <p>{plan.appleProductId ?? 'apple: —'}</p>
          <p>{plan.googleProductId ?? 'google: —'}</p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (plan) => (
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setForm({
                id: plan.id,
                slug: plan.slug,
                name: plan.name,
                description: plan.description ?? '',
                products: plan.products,
                price: (plan.price.amountCents / 100).toFixed(2),
                compareAtPrice: plan.compareAtPrice
                  ? (plan.compareAtPrice.amountCents / 100).toFixed(2)
                  : '',
                interval: plan.interval,
                intervalCount: String(plan.intervalCount),
                trialDays: String(plan.trialDays),
                badge: plan.badge,
                highlight: plan.highlight ?? '',
                isPopular: plan.isPopular,
                isActive: true,
                sortOrder: '0',
                stripePriceId: plan.stripePriceId ?? '',
                appleProductId: plan.appleProductId ?? '',
                googleProductId: plan.googleProductId ?? '',
              });
              setOpen(true);
            }}
          >
            <Pencil size={14} aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (window.confirm('Tarif deaktivieren bzw. löschen?')) remove.mutate(plan.id);
            }}
          >
            <Trash2 size={14} aria-hidden />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Tarife"
        description="Preise, Laufzeiten und Store-Produkt-IDs. Alle Werte werden live in der App verwendet."
        actions={
          <Button
            onClick={() => {
              setForm(EMPTY);
              setOpen(true);
            }}
          >
            <Plus size={15} aria-hidden /> Neuer Tarif
          </Button>
        }
      />

      {plans.isError ? <ErrorBox error={plans.error} /> : null}

      <DataTable
        columns={columns}
        rows={plans.data?.items ?? []}
        loading={plans.isPending}
        rowKey={(plan) => plan.id}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        wide
        title={form.id ? 'Tarif bearbeiten' : 'Neuer Tarif'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Speichern
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {save.isError ? <ErrorBox error={save.error} /> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Slug"
              value={form.slug}
              onChange={(event) => setForm({ ...form, slug: event.target.value })}
              placeholder="combo-3m"
            />
            <Field
              label="Name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>

          <Field
            label="Beschreibung"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />

          <div>
            <span className="label">Enthaltene Produkte</span>
            <div className="flex flex-wrap gap-3">
              {PRODUCTS.map((product) => (
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
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Field
              label="Preis (€)"
              type="number"
              step="0.01"
              value={form.price}
              onChange={(event) => setForm({ ...form, price: event.target.value })}
            />
            <Field
              label="Streichpreis (€)"
              type="number"
              step="0.01"
              value={form.compareAtPrice}
              onChange={(event) => setForm({ ...form, compareAtPrice: event.target.value })}
            />
            <Select
              label="Intervall"
              value={form.interval}
              onChange={(event) => setForm({ ...form, interval: event.target.value })}
              options={['DAY', 'WEEK', 'MONTH', 'YEAR', 'ONE_TIME'].map((value) => ({
                value,
                label: value,
              }))}
            />
            <Field
              label="Anzahl"
              type="number"
              min="1"
              value={form.intervalCount}
              onChange={(event) => setForm({ ...form, intervalCount: event.target.value })}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Testtage"
              type="number"
              min="0"
              value={form.trialDays}
              onChange={(event) => setForm({ ...form, trialDays: event.target.value })}
            />
            <Select
              label="Badge"
              value={form.badge}
              onChange={(event) => setForm({ ...form, badge: event.target.value })}
              options={BADGES.map((value) => ({ value, label: value }))}
            />
            <Field
              label="Hinweistext"
              value={form.highlight}
              onChange={(event) => setForm({ ...form, highlight: event.target.value })}
              placeholder="Spare 21,98 €"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Stripe Price ID"
              value={form.stripePriceId}
              onChange={(event) => setForm({ ...form, stripePriceId: event.target.value })}
            />
            <Field
              label="Apple Product ID"
              value={form.appleProductId}
              onChange={(event) => setForm({ ...form, appleProductId: event.target.value })}
            />
            <Field
              label="Google Product ID"
              value={form.googleProductId}
              onChange={(event) => setForm({ ...form, googleProductId: event.target.value })}
            />
          </div>

          <div className="flex gap-4">
            <Toggle
              label="Als beliebtester Tarif markieren"
              checked={form.isPopular}
              onChange={(value) => setForm({ ...form, isPopular: value })}
            />
            <Toggle
              label="Aktiv"
              checked={form.isActive}
              onChange={(value) => setForm({ ...form, isActive: value })}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
