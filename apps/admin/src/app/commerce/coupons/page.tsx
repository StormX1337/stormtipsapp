'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import type { Paginated } from '@profit-tips/types';
import { api } from '@/lib/api';
import {
  Badge,
  Button,
  DataTable,
  ErrorBox,
  Field,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Toggle,
  type Column,
} from '@/components/ui';

interface CouponRow {
  id: string;
  code: string;
  description: string | null;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  currency: string;
  maxRedemptions: number | null;
  maxRedemptionsPerUser: number;
  redemptionCount: number;
  minPurchaseCents: number;
  applicableProducts: string[];
  validUntil: string | null;
  isActive: boolean;
}

export default function CouponsPage(): ReactNode {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: '',
    description: '',
    discountType: 'PERCENTAGE',
    discountValue: '20',
    maxRedemptions: '',
    maxRedemptionsPerUser: '1',
    minPurchase: '0',
    products: [] as string[],
    validUntil: '',
    isActive: true,
  });

  const coupons = useQuery({
    queryKey: ['admin-coupons', page],
    queryFn: () => api<Paginated<CouponRow>>(`/admin/commerce/coupons?page=${page}&limit=25`),
  });

  const create = useMutation({
    mutationFn: () =>
      api('/admin/commerce/coupons', {
        method: 'POST',
        body: {
          code: form.code.toUpperCase(),
          description: form.description || null,
          discountType: form.discountType,
          // A fixed discount is entered in euros but stored in minor units.
          discountValue:
            form.discountType === 'FIXED'
              ? Math.round(Number(form.discountValue) * 100)
              : Number(form.discountValue),
          maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
          maxRedemptionsPerUser: Number(form.maxRedemptionsPerUser),
          minPurchaseCents: Math.round(Number(form.minPurchase) * 100),
          applicableProducts: form.products,
          validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : null,
          isActive: form.isActive,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      setOpen(false);
    },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api(`/admin/commerce/coupons/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-coupons'] }),
  });

  const columns: Column<CouponRow>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (coupon) => (
        <div>
          <p className="font-mono font-bold">{coupon.code}</p>
          <p className="text-[11px] text-ink-dim">{coupon.description ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'discount',
      header: 'Rabatt',
      render: (coupon) =>
        coupon.discountType === 'PERCENTAGE'
          ? `${coupon.discountValue} %`
          : `${(coupon.discountValue / 100).toFixed(2)} ${coupon.currency}`,
    },
    {
      key: 'usage',
      header: 'Einlösungen',
      align: 'right',
      render: (coupon) => (
        <span className="tabular">
          {coupon.redemptionCount}
          {coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : ''}
        </span>
      ),
    },
    {
      key: 'products',
      header: 'Produkte',
      render: (coupon) =>
        coupon.applicableProducts.length === 0 ? (
          <span className="text-ink-dim">alle</span>
        ) : (
          <div className="flex gap-1">
            {coupon.applicableProducts.map((product) => (
              <Badge key={product} tone="warning">
                {product}
              </Badge>
            ))}
          </div>
        ),
    },
    {
      key: 'valid',
      header: 'Gültig bis',
      render: (coupon) =>
        coupon.validUntil ? new Date(coupon.validUntil).toLocaleDateString('de-DE') : 'unbefristet',
    },
    {
      key: 'active',
      header: 'Status',
      render: (coupon) => (
        <Badge tone={coupon.isActive ? 'positive' : 'neutral'}>
          {coupon.isActive ? 'AKTIV' : 'INAKTIV'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (coupon) =>
        coupon.isActive ? (
          <Button size="sm" variant="ghost" onClick={() => deactivate.mutate(coupon.id)}>
            <Trash2 size={14} aria-hidden />
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Gutscheine"
        description="Rabattcodes mit Limits pro Code und pro Nutzer."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={15} aria-hidden /> Neuer Code
          </Button>
        }
      />

      {coupons.isError ? <ErrorBox error={coupons.error} /> : null}

      <DataTable
        columns={columns}
        rows={coupons.data?.items ?? []}
        loading={coupons.isPending}
        rowKey={(coupon) => coupon.id}
      />

      {coupons.data ? (
        <Pagination page={coupons.data.page} totalPages={coupons.data.totalPages} onChange={setPage} />
      ) : null}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Neuer Gutschein"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              Anlegen
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {create.isError ? <ErrorBox error={create.error} /> : null}
          <Field
            label="Code"
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
            placeholder="WELCOME20"
          />
          <Field
            label="Beschreibung"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Art"
              value={form.discountType}
              onChange={(event) => setForm({ ...form, discountType: event.target.value })}
              options={[
                { value: 'PERCENTAGE', label: 'Prozent' },
                { value: 'FIXED', label: 'Fester Betrag' },
              ]}
            />
            <Field
              label={form.discountType === 'PERCENTAGE' ? 'Rabatt (%)' : 'Rabatt (€)'}
              type="number"
              step={form.discountType === 'PERCENTAGE' ? '1' : '0.01'}
              value={form.discountValue}
              onChange={(event) => setForm({ ...form, discountValue: event.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Max. Einlösungen"
              type="number"
              value={form.maxRedemptions}
              onChange={(event) => setForm({ ...form, maxRedemptions: event.target.value })}
              placeholder="unbegrenzt"
            />
            <Field
              label="Pro Nutzer"
              type="number"
              min="1"
              value={form.maxRedemptionsPerUser}
              onChange={(event) => setForm({ ...form, maxRedemptionsPerUser: event.target.value })}
            />
            <Field
              label="Mindestbestellwert (€)"
              type="number"
              step="0.01"
              value={form.minPurchase}
              onChange={(event) => setForm({ ...form, minPurchase: event.target.value })}
            />
          </div>
          <div>
            <span className="label">Gilt für Produkte (leer = alle)</span>
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
            </div>
          </div>
          <Field
            label="Gültig bis"
            type="datetime-local"
            value={form.validUntil}
            onChange={(event) => setForm({ ...form, validUntil: event.target.value })}
          />
        </div>
      </Modal>
    </>
  );
}
