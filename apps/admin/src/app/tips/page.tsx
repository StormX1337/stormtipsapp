'use client';

import { Suspense, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Check, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import type { Paginated, TipDTO, TipOutcome } from '@storm-tips/types';
import { api } from '@/lib/api';
import { useAdminAuth } from '@/lib/auth';
import { TipEditor } from '@/components/tip-editor';
import {
  Badge,
  Button,
  DataTable,
  ErrorBox,
  Modal,
  PageHeader,
  Pagination,
  Select,
  type Column,
} from '@/components/ui';

const OUTCOME_TONE: Record<TipOutcome, 'neutral' | 'positive' | 'negative' | 'warning' | 'info'> = {
  PENDING: 'neutral',
  LIVE: 'info',
  WON: 'positive',
  LOST: 'negative',
  VOID: 'neutral',
  HALF_WON: 'positive',
  HALF_LOST: 'warning',
};

function SettleDialog({ tip, onClose }: { tip: TipDTO | null; onClose: () => void }): ReactNode {
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState<TipOutcome>('WON');
  const [note, setNote] = useState('');

  const settle = useMutation({
    mutationFn: () =>
      api(`/admin/tips/${tip?.id}/settle`, {
        method: 'POST',
        body: { outcome, note: note || null },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-tips'] });
      onClose();
    },
  });

  return (
    <Modal
      open={Boolean(tip)}
      onClose={onClose}
      title="Settle tip manually"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => settle.mutate()} disabled={settle.isPending}>
            Settle
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {settle.isError ? <ErrorBox error={settle.error} /> : null}
        <p className="text-[12.5px] text-ink-muted">
          {tip?.selectionLabel} @ {tip?.odds?.toFixed(2)} — {tip?.event.homeTeam.name} vs{' '}
          {tip?.event.awayTeam.name}
        </p>
        <Select
          label="Outcome"
          value={outcome}
          onChange={(event) => setOutcome(event.target.value as TipOutcome)}
          options={['WON', 'LOST', 'VOID', 'HALF_WON', 'HALF_LOST'].map((value) => ({
            value,
            label: value,
          }))}
        />
        <label className="block">
          <span className="label">Note</span>
          <input
            className="input"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Why was this settled by hand?"
          />
        </label>
        <p className="text-[11px] text-ink-dim">
          A manual settlement is recorded against your account and can only be undone by resetting
          the tip.
        </p>
      </div>
    </Modal>
  );
}

function TipsContent(): ReactNode {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { can } = useAdminAuth();

  const [page, setPage] = useState(1);
  const [product, setProduct] = useState(searchParams.get('product') ?? '');
  const [status, setStatus] = useState('');
  const [outcome, setOutcome] = useState('');
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<TipDTO | null>(null);
  const [settling, setSettling] = useState<TipDTO | null>(null);

  const live = searchParams.get('live') === 'true';

  const query = new URLSearchParams({ page: String(page), limit: '25' });
  if (product) query.set('product', product);
  if (status) query.set('status', status);
  if (outcome) query.set('outcome', outcome);
  if (search) query.set('search', search);

  const tips = useQuery({
    queryKey: ['admin-tips', query.toString(), live],
    queryFn: () => api<Paginated<TipDTO>>(`/admin/tips?${query.toString()}`),
  });

  const publish = useMutation({
    mutationFn: (id: string) => api(`/admin/tips/${id}/publish`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-tips'] }),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api(`/admin/tips/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-tips'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/tips/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-tips'] }),
  });

  const rows = (tips.data?.items ?? []).filter((tip) => (live ? tip.isLive : true));

  const columns: Column<TipDTO>[] = [
    {
      key: 'event',
      header: 'Event',
      render: (tip) => (
        <div>
          <p className="font-medium">
            {tip.event.homeTeam.shortName ?? tip.event.homeTeam.name} –{' '}
            {tip.event.awayTeam.shortName ?? tip.event.awayTeam.name}
          </p>
          <p className="text-[11px] text-ink-dim">
            {tip.league.name} ·{' '}
            {new Date(tip.event.startsAt).toLocaleString('en-GB', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      ),
    },
    {
      key: 'selection',
      header: 'Selection',
      render: (tip) => (
        <div>
          <p className="font-semibold text-accent-500">{tip.selectionLabel}</p>
          <p className="text-[11px] text-ink-dim">
            {tip.marketType}
            {tip.line !== null ? ` · ${tip.line}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'odds',
      header: 'Odds',
      align: 'right',
      render: (tip) => (
        <span className="tabular font-bold">
          {tip.odds?.toFixed(2)}
          {tip.oddsChanged ? <span className="ml-1 text-gold-400">▲</span> : null}
        </span>
      ),
    },
    {
      key: 'product',
      header: 'Product',
      render: (tip) => (
        <Badge tone={tip.product === 'FREE' ? 'neutral' : 'warning'}>{tip.product}</Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (tip) => (
        <div className="flex flex-col gap-1">
          <Badge tone={tip.status === 'PUBLISHED' ? 'positive' : 'neutral'}>{tip.status}</Badge>
          <Badge tone={OUTCOME_TONE[tip.outcome]}>{tip.outcome}</Badge>
        </div>
      ),
    },
    {
      key: 'profit',
      header: 'Profit',
      align: 'right',
      render: (tip) =>
        tip.result ? (
          <span
            className={'tabular font-bold ' + (tip.result.profit >= 0 ? 'text-won' : 'text-lost')}
          >
            {tip.result.profit > 0 ? '+' : ''}
            {tip.result.profit.toFixed(2)}
          </span>
        ) : (
          <span className="text-ink-dim">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (tip) => (
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            title="Edit"
            onClick={() => {
              setEditing(tip);
              setEditorOpen(true);
            }}
          >
            <Pencil size={14} aria-hidden />
          </Button>
          {tip.status !== 'PUBLISHED' ? (
            <Button
              size="sm"
              variant="ghost"
              title="Publish"
              onClick={() => publish.mutate(tip.id)}
            >
              <Send size={14} aria-hidden />
            </Button>
          ) : null}
          {can('ADMIN') && !tip.result ? (
            <Button size="sm" variant="ghost" title="Settle" onClick={() => setSettling(tip)}>
              <Check size={14} aria-hidden />
            </Button>
          ) : null}
          {tip.status === 'PUBLISHED' && !tip.result ? (
            <Button size="sm" variant="ghost" title="Cancel" onClick={() => cancel.mutate(tip.id)}>
              <X size={14} aria-hidden />
            </Button>
          ) : null}
          {can('ADMIN') ? (
            <Button
              size="sm"
              variant="ghost"
              title="Delete"
              onClick={() => {
                if (window.confirm('Delete this tip permanently?')) remove.mutate(tip.id);
              }}
            >
              <Trash2 size={14} aria-hidden />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={live ? 'Live tips' : 'Tips'}
        description="Create, publish, settle and review analyses."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
          >
            <Plus size={15} aria-hidden /> New tip
          </Button>
        }
      />

      <div className="mb-3 grid gap-2 sm:grid-cols-4">
        <Select
          label="Product"
          value={product}
          onChange={(event) => {
            setProduct(event.target.value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All' },
            ...['FREE', 'VIP', 'EXTRA', 'COMBO', 'FIX_ODDS'].map((value) => ({
              value,
              label: value,
            })),
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
            { value: '', label: 'All' },
            ...['DRAFT', 'SCHEDULED', 'PUBLISHED', 'CANCELLED'].map((value) => ({
              value,
              label: value,
            })),
          ]}
        />
        <Select
          label="Outcome"
          value={outcome}
          onChange={(event) => {
            setOutcome(event.target.value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All' },
            ...['PENDING', 'LIVE', 'WON', 'LOST', 'VOID', 'HALF_WON', 'HALF_LOST'].map((value) => ({
              value,
              label: value,
            })),
          ]}
        />
        <label className="block">
          <span className="label">Search</span>
          <input
            className="input"
            value={search}
            placeholder="Team, selection…"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>

      {tips.isError ? <ErrorBox error={tips.error} /> : null}

      <DataTable
        columns={columns}
        rows={rows}
        loading={tips.isPending}
        rowKey={(tip) => tip.id}
        empty="No tips found"
      />

      {tips.data ? (
        <Pagination page={tips.data.page} totalPages={tips.data.totalPages} onChange={setPage} />
      ) : null}

      <TipEditor open={editorOpen} tip={editing} onClose={() => setEditorOpen(false)} />
      <SettleDialog tip={settling} onClose={() => setSettling(null)} />
    </>
  );
}

export default function TipsPage(): ReactNode {
  return (
    <Suspense fallback={null}>
      <TipsContent />
    </Suspense>
  );
}
