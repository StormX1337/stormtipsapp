'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Plus, RefreshCw } from 'lucide-react';
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

interface ProviderRow {
  id: string;
  slug: string;
  name: string;
  kind: string;
  baseUrl: string | null;
  apiKeyPreview: string | null;
  hasApiKey: boolean;
  isActive: boolean;
  priority: number;
  pollIntervalSeconds: number;
  rateLimitPerMinute: number;
  enabledSports: string[];
  lastSyncAt: string | null;
  lastError: string | null;
}

interface ProvidersResponse {
  available: { slug: string; name: string; requiresApiKey: boolean; docsUrl: string }[];
  items: ProviderRow[];
}

export default function ProvidersPage(): ReactNode {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<string | null>(null);
  const [form, setForm] = useState({
    slug: 'sportsgameodds',
    name: 'SportsGameOdds',
    kind: 'SPORTS',
    baseUrl: '',
    apiKey: '',
    isActive: false,
    priority: '10',
    pollIntervalSeconds: '120',
    rateLimitPerMinute: '60',
    enabledSports: 'football',
  });

  const providers = useQuery({
    queryKey: ['admin-providers'],
    queryFn: () => api<ProvidersResponse>('/admin/ops/providers'),
  });

  const save = useMutation({
    mutationFn: () =>
      api('/admin/ops/providers', {
        method: 'POST',
        body: {
          slug: form.slug,
          name: form.name,
          kind: form.kind,
          baseUrl: form.baseUrl || null,
          // Only sent when the operator typed a new key; otherwise the stored
          // ciphertext stays untouched.
          apiKey: form.apiKey || null,
          isActive: form.isActive,
          priority: Number(form.priority),
          pollIntervalSeconds: Number(form.pollIntervalSeconds),
          rateLimitPerMinute: Number(form.rateLimitPerMinute),
          enabledSports: form.enabledSports
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-providers'] });
      setOpen(false);
      setForm({ ...form, apiKey: '' });
    },
  });

  const test = useMutation({
    mutationFn: (slug: string) =>
      api<{ ok: boolean; latencyMs: number; message?: string; fellBack: boolean }>(
        `/admin/ops/providers/${slug}/test`,
        { method: 'POST' },
      ),
    onSuccess: (result) =>
      setHealth(
        result.ok
          ? `Verbindung erfolgreich (${result.latencyMs} ms)${result.fellBack ? ' — Fallback auf Mock-Provider!' : ''}`
          : `Fehlgeschlagen: ${result.message ?? 'unbekannt'}`,
      ),
  });

  const sync = useMutation({
    mutationFn: (kind: string) => api(`/admin/ops/providers/sync/${kind}`, { method: 'POST' }),
  });

  const columns: Column<ProviderRow>[] = [
    {
      key: 'name',
      header: 'Provider',
      render: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-[11px] text-ink-dim">{row.slug}</p>
        </div>
      ),
    },
    { key: 'kind', header: 'Art', render: (row) => <Badge>{row.kind}</Badge> },
    {
      key: 'key',
      header: 'API-Key',
      render: (row) =>
        row.hasApiKey ? (
          <span className="font-mono text-[11px] text-ink-dim">{row.apiKeyPreview}</span>
        ) : (
          <span className="text-[11px] text-ink-dim">nicht gesetzt</span>
        ),
    },
    {
      key: 'polling',
      header: 'Polling',
      render: (row) => `${row.pollIntervalSeconds}s · ${row.rateLimitPerMinute}/min`,
    },
    {
      key: 'active',
      header: 'Status',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <Badge tone={row.isActive ? 'positive' : 'neutral'}>
            {row.isActive ? 'AKTIV' : 'INAKTIV'}
          </Badge>
          {row.lastError ? <Badge tone="negative">FEHLER</Badge> : null}
        </div>
      ),
    },
    {
      key: 'lastSync',
      header: 'Letzter Sync',
      render: (row) => (
        <div>
          <p>{row.lastSyncAt ? new Date(row.lastSyncAt).toLocaleString('de-DE') : '—'}</p>
          {row.lastError ? (
            <p className="text-[11px] text-lost">{row.lastError.slice(0, 60)}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <Button size="sm" variant="ghost" onClick={() => test.mutate(row.slug)}>
          <Activity size={14} aria-hidden /> Testen
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="API-Provider"
        description="Datenanbieter konfigurieren. Schlüssel werden AES-256-GCM verschlüsselt gespeichert und nie zurückgegeben."
        actions={
          <>
            <Button variant="outline" onClick={() => sync.mutate('fixtures')}>
              <RefreshCw size={14} aria-hidden /> Sync starten
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus size={15} aria-hidden /> Provider
            </Button>
          </>
        }
      />

      {providers.isError ? <ErrorBox error={providers.error} /> : null}
      {health ? (
        <p className="mb-3 rounded-sm bg-bg-card-alt px-3 py-2 text-[12px] text-ink-muted">
          {health}
        </p>
      ) : null}

      <DataTable
        columns={columns}
        rows={providers.data?.items ?? []}
        loading={providers.isPending}
        rowKey={(row) => row.id}
      />

      <section className="mt-5 card p-4">
        <h2 className="mb-2 text-[14px] font-bold">Unterstützte Anbieter</h2>
        <ul className="flex flex-col gap-1 text-[12.5px] text-ink-muted">
          {(providers.data?.available ?? []).map((entry) => (
            <li key={entry.slug}>
              <span className="font-semibold text-ink">{entry.name}</span> — {entry.slug}
              {entry.requiresApiKey ? ' · API-Key erforderlich' : ' · kein Schlüssel nötig'}
              {entry.docsUrl ? (
                <>
                  {' · '}
                  <a
                    href={entry.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent-500 hover:underline"
                  >
                    Doku
                  </a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        wide
        title="Provider konfigurieren"
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
            <Select
              label="Anbieter"
              value={form.slug}
              onChange={(event) => {
                const slug = event.target.value;
                const entry = providers.data?.available.find((item) => item.slug === slug);
                setForm({ ...form, slug, name: entry?.name ?? slug });
              }}
              options={(providers.data?.available ?? []).map((entry) => ({
                value: entry.slug,
                label: entry.name,
              }))}
            />
            <Select
              label="Art"
              value={form.kind}
              onChange={(event) => setForm({ ...form, kind: event.target.value })}
              options={['SPORTS', 'ODDS', 'PUSH', 'EMAIL'].map((value) => ({
                value,
                label: value,
              }))}
            />
          </div>
          <Field
            label="Basis-URL"
            value={form.baseUrl}
            onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
            placeholder="https://api.sportsgameodds.com/v2"
          />
          <Field
            label="API-Key"
            type="password"
            value={form.apiKey}
            onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
            hint="Leer lassen, um den gespeicherten Schlüssel unverändert zu behalten."
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Priorität"
              type="number"
              value={form.priority}
              onChange={(event) => setForm({ ...form, priority: event.target.value })}
            />
            <Field
              label="Polling-Intervall (s)"
              type="number"
              min="10"
              value={form.pollIntervalSeconds}
              onChange={(event) => setForm({ ...form, pollIntervalSeconds: event.target.value })}
            />
            <Field
              label="Rate-Limit / Minute"
              type="number"
              min="1"
              value={form.rateLimitPerMinute}
              onChange={(event) => setForm({ ...form, rateLimitPerMinute: event.target.value })}
            />
          </div>
          <Field
            label="Aktive Sportarten (kommagetrennt)"
            value={form.enabledSports}
            onChange={(event) => setForm({ ...form, enabledSports: event.target.value })}
          />
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
