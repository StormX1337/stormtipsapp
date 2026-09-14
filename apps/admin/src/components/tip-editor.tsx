'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EventDTO, Paginated, TipDTO } from '@storm-tips/types';
import { MARKET_SELECTIONS, MarketType, marketRequiresLine } from '@storm-tips/types';
import { api } from '@/lib/api';
import { Button, ErrorBox, Field, Modal, Select, TextArea, Toggle } from './ui';

const PRODUCTS = ['FREE', 'VIP', 'EXTRA', 'COMBO', 'FIX_ODDS'] as const;
const STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED'] as const;

interface FormState {
  eventId: string;
  marketType: string;
  selectionKey: string;
  selectionLabel: string;
  line: string;
  odds: string;
  stake: string;
  bookmakerId: string;
  confidence: string;
  product: string;
  status: string;
  isLive: boolean;
  analysis: string;
  publishAt: string;
  tags: string;
}

const EMPTY: FormState = {
  eventId: '',
  marketType: MarketType.MATCH_WINNER,
  selectionKey: 'HOME',
  selectionLabel: '',
  line: '',
  odds: '1.80',
  stake: '10',
  bookmakerId: '',
  confidence: '70',
  product: 'FREE',
  status: 'DRAFT',
  isLive: false,
  analysis: '',
  publishAt: '',
  tags: '',
};

/**
 * Tip editor.
 *
 * Mirrors the server's validation locally so an operator sees the problem
 * before submitting: legal selections per market, a required line for
 * line-based markets, and an auto-generated human readable label.
 */
export function TipEditor({
  open,
  onClose,
  tip,
}: {
  open: boolean;
  onClose: () => void;
  tip?: TipDTO | null;
}): ReactNode {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [eventSearch, setEventSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(
      tip
        ? {
            eventId: tip.event.id,
            marketType: tip.marketType,
            selectionKey: tip.selectionKey ?? 'HOME',
            selectionLabel: tip.selectionLabel ?? '',
            line: tip.line?.toString() ?? '',
            odds: tip.odds?.toString() ?? '1.80',
            stake: tip.stake.toString(),
            bookmakerId: tip.bookmaker?.id ?? '',
            confidence: tip.confidence?.toString() ?? '70',
            product: tip.product,
            status: tip.status === 'CANCELLED' ? 'DRAFT' : tip.status,
            isLive: tip.isLive,
            analysis: tip.analysis ?? '',
            publishAt: tip.publishAt ? tip.publishAt.slice(0, 16) : '',
            tags: tip.tags.join(', '),
          }
        : EMPTY,
    );
  }, [open, tip]);

  const events = useQuery({
    queryKey: ['admin-events'],
    queryFn: () => api<Paginated<EventDTO>>('/admin/catalogue/events?limit=100'),
    enabled: open,
  });

  const bookmakers = useQuery({
    queryKey: ['admin-bookmakers'],
    queryFn: () => api<{ items: { id: string; name: string }[] }>('/admin/catalogue/bookmakers'),
    enabled: open,
  });

  const selectedEvent = events.data?.items.find((event) => event.id === form.eventId);

  const filteredEvents = useMemo(() => {
    const items = events.data?.items ?? [];
    if (!eventSearch.trim()) return items.slice(0, 60);
    const needle = eventSearch.toLowerCase();
    return items
      .filter((event) =>
        `${event.homeTeam.name} ${event.awayTeam.name} ${event.league.name}`
          .toLowerCase()
          .includes(needle),
      )
      .slice(0, 60);
  }, [events.data, eventSearch]);

  const allowedSelections = MARKET_SELECTIONS[form.marketType as MarketType] ?? [];
  const needsLine = marketRequiresLine(form.marketType as MarketType);

  // Keep the human readable label in step with the machine selection.
  useEffect(() => {
    if (!selectedEvent) return;
    const home = (selectedEvent.homeTeam.shortName ?? selectedEvent.homeTeam.name).toUpperCase();
    const away = (selectedEvent.awayTeam.shortName ?? selectedEvent.awayTeam.name).toUpperCase();
    const line = form.line ? Number(form.line) : null;
    const suffix = line !== null && !Number.isNaN(line) ? ` ${line > 0 ? '+' : ''}${line}` : '';

    const label = (() => {
      switch (form.selectionKey) {
        case 'HOME':
          return form.marketType === 'ASIAN_HANDICAP'
            ? `ASIAN HANDICAP${suffix} ${home}`
            : `${home} WIN`;
        case 'AWAY':
          return form.marketType === 'ASIAN_HANDICAP'
            ? `ASIAN HANDICAP${suffix} ${away}`
            : `${away} WIN`;
        case 'DRAW':
          return 'DRAW';
        case 'HOME_OR_DRAW':
          return `${home} WIN OR DRAW`;
        case 'AWAY_OR_DRAW':
          return `${away} WIN OR DRAW`;
        case 'HOME_OR_AWAY':
          return 'HOME OR AWAY';
        case 'OVER':
          return `OVER${suffix} GOALS`;
        case 'UNDER':
          return `UNDER${suffix} GOALS`;
        case 'BTTS_YES':
          return 'BOTH TEAMS TO SCORE';
        case 'BTTS_NO':
          return 'BOTH TEAMS TO SCORE - NO';
        default:
          return form.selectionKey.replace(/_/g, ' ');
      }
    })();

    setForm((current) => ({ ...current, selectionLabel: label }));
  }, [selectedEvent, form.selectionKey, form.marketType, form.line]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        eventId: form.eventId,
        marketType: form.marketType,
        selectionKey: form.selectionKey,
        selectionLabel: form.selectionLabel,
        line: form.line === '' ? null : Number(form.line),
        odds: Number(form.odds),
        stake: Number(form.stake),
        bookmakerId: form.bookmakerId || null,
        confidence: Number(form.confidence),
        product: form.product,
        status: form.status,
        isLive: form.isLive,
        analysis: form.analysis || null,
        tags: form.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : null,
      };
      return tip
        ? api(`/admin/tips/${tip.id}`, { method: 'PATCH', body })
        : api('/admin/tips', { method: 'POST', body });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-tips'] });
      onClose();
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={tip ? 'Edit tip' : 'New tip'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !form.eventId || (needsLine && form.line === '')}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {save.isError ? <ErrorBox error={save.error} /> : null}

        <Field
          label="Find an event"
          placeholder="Team or league"
          value={eventSearch}
          onChange={(event) => setEventSearch(event.target.value)}
        />

        <Select
          label="Event"
          value={form.eventId}
          onChange={(event) => setForm({ ...form, eventId: event.target.value })}
          options={[
            { value: '', label: events.isPending ? 'Loading…' : 'Select an event' },
            ...filteredEvents.map((event) => ({
              value: event.id,
              label: `${new Date(event.startsAt).toLocaleString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })} · ${event.league.name}: ${event.homeTeam.name} – ${event.awayTeam.name}`,
            })),
          ]}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Market"
            value={form.marketType}
            onChange={(event) => {
              const marketType = event.target.value;
              const allowed = MARKET_SELECTIONS[marketType as MarketType] ?? [];
              setForm({
                ...form,
                marketType,
                selectionKey: allowed[0] ?? form.selectionKey,
                line: marketRequiresLine(marketType as MarketType) ? form.line || '2.5' : '',
              });
            }}
            options={Object.values(MarketType).map((value) => ({ value, label: value }))}
          />
          <Select
            label="Selection"
            value={form.selectionKey}
            onChange={(event) => setForm({ ...form, selectionKey: event.target.value })}
            options={
              allowedSelections.length > 0
                ? allowedSelections.map((value) => ({ value, label: value }))
                : [{ value: form.selectionKey, label: form.selectionKey || 'free text' }]
            }
          />
        </div>

        {allowedSelections.length === 0 ? (
          <Field
            label="Selection (free text, e.g. 2-1)"
            value={form.selectionKey}
            onChange={(event) => setForm({ ...form, selectionKey: event.target.value })}
          />
        ) : null}

        <Field
          label="Display label"
          hint="Shown to the reader; suggested automatically as you edit."
          value={form.selectionLabel}
          onChange={(event) => setForm({ ...form, selectionLabel: event.target.value })}
        />

        <div className="grid gap-3 sm:grid-cols-4">
          <Field
            label={needsLine ? 'Line *' : 'Line'}
            type="number"
            step="0.25"
            value={form.line}
            onChange={(event) => setForm({ ...form, line: event.target.value })}
            error={needsLine && form.line === '' ? 'Required' : undefined}
          />
          <Field
            label="Odds"
            type="number"
            step="0.01"
            min="1.01"
            value={form.odds}
            onChange={(event) => setForm({ ...form, odds: event.target.value })}
          />
          <Field
            label="Stake"
            type="number"
            step="0.5"
            value={form.stake}
            onChange={(event) => setForm({ ...form, stake: event.target.value })}
          />
          <Field
            label="Confidence %"
            type="number"
            min="1"
            max="100"
            value={form.confidence}
            onChange={(event) => setForm({ ...form, confidence: event.target.value })}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Select
            label="Product"
            value={form.product}
            onChange={(event) => setForm({ ...form, product: event.target.value })}
            options={PRODUCTS.map((value) => ({ value, label: value }))}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
            options={STATUSES.map((value) => ({ value, label: value }))}
          />
          <Select
            label="Bookmaker"
            value={form.bookmakerId}
            onChange={(event) => setForm({ ...form, bookmakerId: event.target.value })}
            options={[
              { value: '', label: '—' },
              ...(bookmakers.data?.items ?? []).map((bookmaker) => ({
                value: bookmaker.id,
                label: bookmaker.name,
              })),
            ]}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Publish at"
            type="datetime-local"
            hint="Empty = immediately once the status is PUBLISHED"
            value={form.publishAt}
            onChange={(event) => setForm({ ...form, publishAt: event.target.value })}
          />
          <Field
            label="Tags (comma-separated)"
            value={form.tags}
            onChange={(event) => setForm({ ...form, tags: event.target.value })}
          />
        </div>

        <Toggle
          label="Live tip"
          checked={form.isLive}
          onChange={(value) => setForm({ ...form, isLive: value })}
        />

        <TextArea
          label="Analysis"
          value={form.analysis}
          onChange={(event) => setForm({ ...form, analysis: event.target.value })}
          placeholder="Why this selection…"
        />
      </div>
    </Modal>
  );
}
