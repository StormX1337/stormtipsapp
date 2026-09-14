'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Send } from 'lucide-react';
import type { ComboDTO, Paginated, TipDTO } from '@profit-tips/types';
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
  TextArea,
  type Column,
} from '@/components/ui';

function ComboCreator({ open, onClose }: { open: boolean; onClose: () => void }): ReactNode {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [product, setProduct] = useState('COMBO');
  const [stake, setStake] = useState('10');
  const [analysis, setAnalysis] = useState('');
  const [publishAt, setPublishAt] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  // Only open selections can be combined; a settled leg would make the combo
  // unsettleable in a sane way.
  const candidates = useQuery({
    queryKey: ['combo-candidates'],
    queryFn: () => api<Paginated<TipDTO>>('/admin/tips?limit=100&outcome=PENDING'),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: () =>
      api('/admin/tips/combos', {
        method: 'POST',
        body: {
          title,
          product,
          stake: Number(stake),
          analysis: analysis || null,
          status: publishAt ? 'SCHEDULED' : 'DRAFT',
          publishAt: publishAt ? new Date(publishAt).toISOString() : null,
          tipIds: selected,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-combos'] });
      onClose();
      setSelected([]);
      setTitle('');
    },
  });

  const totalOdds = (candidates.data?.items ?? [])
    .filter((tip) => selected.includes(tip.id))
    .reduce((acc, tip) => acc * (tip.odds ?? 1), 1);

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Neue Kombination"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || selected.length < 2 || title.length < 2}
          >
            Anlegen ({selected.length})
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {create.isError ? <ErrorBox error={create.error} /> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Titel"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="3er-Kombi Samstag"
          />
          <Select
            label="Produkt"
            value={product}
            onChange={(event) => setProduct(event.target.value)}
            options={['COMBO', 'VIP', 'EXTRA'].map((value) => ({ value, label: value }))}
          />
          <Field
            label="Einsatz"
            type="number"
            step="0.5"
            value={stake}
            onChange={(event) => setStake(event.target.value)}
          />
          <Field
            label="Veröffentlichen am"
            type="datetime-local"
            value={publishAt}
            onChange={(event) => setPublishAt(event.target.value)}
          />
        </div>

        <TextArea
          label="Analyse"
          value={analysis}
          onChange={(event) => setAnalysis(event.target.value)}
        />

        <div>
          <p className="label">
            Auswahlen ({selected.length}) — Gesamtquote{' '}
            <span className="tabular font-bold text-gold-400">
              {selected.length > 0 ? totalOdds.toFixed(2) : '—'}
            </span>
          </p>
          <div className="max-h-72 overflow-y-auto rounded-sm border border-line">
            {(candidates.data?.items ?? []).map((tip) => (
              <label
                key={tip.id}
                className="flex cursor-pointer items-center gap-2 border-b border-line-subtle px-2 py-1.5 last:border-b-0 hover:bg-bg-card-alt"
              >
                <input
                  type="checkbox"
                  className="accent-[#12E17F]"
                  checked={selected.includes(tip.id)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, tip.id]
                        : current.filter((value) => value !== tip.id),
                    )
                  }
                />
                <span className="min-w-0 flex-1 truncate text-[12px]">
                  {tip.event.homeTeam.shortName ?? tip.event.homeTeam.name} –{' '}
                  {tip.event.awayTeam.shortName ?? tip.event.awayTeam.name}
                  <span className="ml-2 font-semibold text-accent-500">{tip.selectionLabel}</span>
                </span>
                <span className="tabular shrink-0 text-[12px] font-bold">
                  {tip.odds?.toFixed(2)}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function CombosPage(): ReactNode {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [creatorOpen, setCreatorOpen] = useState(false);

  const combos = useQuery({
    queryKey: ['admin-combos', page],
    queryFn: () => api<Paginated<ComboDTO>>(`/admin/tips/combos?page=${page}&limit=25`),
  });

  const publish = useMutation({
    mutationFn: (id: string) => api(`/admin/tips/combos/${id}/publish`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-combos'] }),
  });

  const columns: Column<ComboDTO>[] = [
    {
      key: 'title',
      header: 'Kombination',
      render: (combo) => (
        <div>
          <p className="font-medium">{combo.title}</p>
          <p className="text-[11px] text-ink-dim">{combo.items.length} Auswahlen</p>
        </div>
      ),
    },
    {
      key: 'odds',
      header: 'Gesamtquote',
      align: 'right',
      render: (combo) => (
        <span className="tabular font-bold text-gold-400">{combo.totalOdds?.toFixed(2) ?? '—'}</span>
      ),
    },
    { key: 'product', header: 'Produkt', render: (combo) => <Badge tone="warning">{combo.product}</Badge> },
    {
      key: 'status',
      header: 'Status',
      render: (combo) => (
        <div className="flex flex-col gap-1">
          <Badge tone={combo.status === 'PUBLISHED' ? 'positive' : 'neutral'}>{combo.status}</Badge>
          <Badge
            tone={
              combo.outcome === 'WON' ? 'positive' : combo.outcome === 'LOST' ? 'negative' : 'neutral'
            }
          >
            {combo.outcome}
          </Badge>
        </div>
      ),
    },
    {
      key: 'profit',
      header: 'Gewinn',
      align: 'right',
      render: (combo) =>
        combo.profit === null ? (
          <span className="text-ink-dim">—</span>
        ) : (
          <span className={'tabular font-bold ' + (combo.profit >= 0 ? 'text-won' : 'text-lost')}>
            {combo.profit > 0 ? '+' : ''}
            {combo.profit.toFixed(2)}
          </span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (combo) =>
        combo.status !== 'PUBLISHED' ? (
          <Button size="sm" variant="ghost" onClick={() => publish.mutate(combo.id)}>
            <Send size={14} aria-hidden /> Veröffentlichen
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Kombinationen"
        description="Kombi-Wetten zusammenstellen; die Abrechnung erfolgt automatisch aus den Einzelergebnissen."
        actions={
          <Button onClick={() => setCreatorOpen(true)}>
            <Plus size={15} aria-hidden /> Neue Kombi
          </Button>
        }
      />

      {combos.isError ? <ErrorBox error={combos.error} /> : null}

      <DataTable
        columns={columns}
        rows={combos.data?.items ?? []}
        loading={combos.isPending}
        rowKey={(combo) => combo.id}
      />

      {combos.data ? (
        <Pagination page={combos.data.page} totalPages={combos.data.totalPages} onChange={setPage} />
      ) : null}

      <ComboCreator open={creatorOpen} onClose={() => setCreatorOpen(false)} />
    </>
  );
}
