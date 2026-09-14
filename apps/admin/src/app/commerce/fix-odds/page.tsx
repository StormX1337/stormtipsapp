'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import type { FixOddsPlanDTO } from '@profit-tips/types';
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

interface FixForm {
  id?: string;
  slug: string;
  name: string;
  description: string;
  price: string;
  targetOdds: string;
  maxOdds: string;
  minConfidence: string;
  picksPerPeriod: string;
  allowLive: boolean;
  requiresVip: boolean;
  isActive: boolean;
  badge: string;
  stripePriceId: string;
  appleProductId: string;
  googleProductId: string;
}

const EMPTY: FixForm = {
  slug: '',
  name: '',
  description: '',
  price: '29.99',
  targetOdds: '2.00',
  maxOdds: '2.60',
  minConfidence: '65',
  picksPerPeriod: '16',
  allowLive: false,
  requiresVip: false,
  isActive: true,
  badge: 'NONE',
  stripePriceId: '',
  appleProductId: '',
  googleProductId: '',
};

export default function FixOddsPage(): ReactNode {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FixForm>(EMPTY);

  const plans = useQuery({
    queryKey: ['admin-fix-odds'],
    queryFn: () => api<{ items: FixOddsPlanDTO[] }>('/admin/commerce/fix-odds-plans'),
  });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        slug: form.slug,
        name: form.name,
        description: form.description || null,
        priceCents: Math.round(Number(form.price) * 100),
        currency: 'EUR',
        targetOdds: Number(form.targetOdds),
        maxOdds: Number(form.maxOdds),
        minConfidence: Number(form.minConfidence),
        picksPerPeriod: Number(form.picksPerPeriod),
        allowLive: form.allowLive,
        requiresVip: form.requiresVip,
        isActive: form.isActive,
        badge: form.badge,
        stripePriceId: form.stripePriceId || null,
        appleProductId: form.appleProductId || null,
        googleProductId: form.googleProductId || null,
      };
      return form.id
        ? api(`/admin/commerce/fix-odds-plans/${form.id}`, { method: 'PATCH', body })
        : api('/admin/commerce/fix-odds-plans', { method: 'POST', body });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-fix-odds'] });
      setOpen(false);
    },
  });

  const columns: Column<FixOddsPlanDTO>[] = [
    {
      key: 'name',
      header: 'Paket',
      render: (plan) => (
        <div>
          <p className="font-medium">{plan.name}</p>
          <p className="text-[11px] text-ink-dim">{plan.slug}</p>
        </div>
      ),
    },
    {
      key: 'odds',
      header: 'Zielquote',
      align: 'right',
      render: (plan) => (
        <span className="tabular font-bold text-violet-500">
          {plan.targetOdds.toFixed(2)}{' '}
          <span className="text-ink-dim">/ max {plan.maxOdds.toFixed(2)}</span>
        </span>
      ),
    },
    {
      key: 'rules',
      header: 'Regeln',
      render: (plan) => (
        <span className="text-[11.5px] text-ink-muted">
          ≥ {plan.minConfidence}% Konfidenz · {plan.picksPerPeriod} Picks
          {plan.allowLive ? ' · Live' : ''}
          {plan.requiresVip ? ' · VIP nötig' : ''}
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Preis',
      align: 'right',
      render: (plan) => <span className="tabular font-bold">{plan.price.formatted}</span>,
    },
    {
      key: 'badge',
      header: 'Badge',
      render: (plan) => (plan.badge === 'NONE' ? '—' : <Badge tone="info">{plan.badge}</Badge>),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (plan) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setForm({
              id: plan.id,
              slug: plan.slug,
              name: plan.name,
              description: plan.description ?? '',
              price: (plan.price.amountCents / 100).toFixed(2),
              targetOdds: plan.targetOdds.toFixed(2),
              maxOdds: plan.maxOdds.toFixed(2),
              minConfidence: String(plan.minConfidence),
              picksPerPeriod: String(plan.picksPerPeriod),
              allowLive: plan.allowLive,
              requiresVip: plan.requiresVip,
              isActive: true,
              badge: plan.badge,
              stripePriceId: '',
              appleProductId: '',
              googleProductId: '',
            });
            setOpen(true);
          }}
        >
          <Pencil size={14} aria-hidden />
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="FIX Odds Pakete"
        description="Pakete mit fester Zielquote, Mindest-Konfidenz und definierter Anzahl Auswahlen."
        actions={
          <Button
            onClick={() => {
              setForm(EMPTY);
              setOpen(true);
            }}
          >
            <Plus size={15} aria-hidden /> Neues Paket
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
        title={form.id ? 'Paket bearbeiten' : 'Neues Paket'}
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
          <div className="grid gap-3 sm:grid-cols-4">
            <Field
              label="Preis (€)"
              type="number"
              step="0.01"
              value={form.price}
              onChange={(event) => setForm({ ...form, price: event.target.value })}
            />
            <Field
              label="Zielquote"
              type="number"
              step="0.05"
              value={form.targetOdds}
              onChange={(event) => setForm({ ...form, targetOdds: event.target.value })}
            />
            <Field
              label="Maximalquote"
              type="number"
              step="0.05"
              value={form.maxOdds}
              onChange={(event) => setForm({ ...form, maxOdds: event.target.value })}
            />
            <Field
              label="Min. Konfidenz %"
              type="number"
              min="1"
              max="100"
              value={form.minConfidence}
              onChange={(event) => setForm({ ...form, minConfidence: event.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Picks pro Periode"
              type="number"
              min="1"
              value={form.picksPerPeriod}
              onChange={(event) => setForm({ ...form, picksPerPeriod: event.target.value })}
            />
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
          </div>
          <div className="flex flex-wrap gap-4">
            <Toggle
              label="Live-Auswahlen erlaubt"
              checked={form.allowLive}
              onChange={(value) => setForm({ ...form, allowLive: value })}
            />
            <Toggle
              label="Setzt VIP voraus"
              checked={form.requiresVip}
              onChange={(value) => setForm({ ...form, requiresVip: value })}
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
