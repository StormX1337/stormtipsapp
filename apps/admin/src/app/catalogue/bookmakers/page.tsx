'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import {
  Badge,
  Button,
  DataTable,
  ErrorBox,
  Field,
  Modal,
  PageHeader,
  Toggle,
  type Column,
} from '@/components/ui';

interface BookmakerRow {
  id: string;
  key: string;
  name: string;
  color: string | null;
  website: string | null;
  priority: number;
  isActive: boolean;
}

export default function BookmakersPage(): ReactNode {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    key: '',
    name: '',
    color: '#12E17F',
    website: '',
    priority: '100',
    isActive: true,
  });

  const bookmakers = useQuery({
    queryKey: ['admin-bookmakers'],
    queryFn: () => api<{ items: BookmakerRow[] }>('/admin/catalogue/bookmakers'),
  });

  const save = useMutation({
    mutationFn: () =>
      api('/admin/catalogue/bookmakers', {
        method: 'POST',
        body: {
          key: form.key,
          name: form.name,
          color: form.color,
          website: form.website || null,
          priority: Number(form.priority),
          isActive: form.isActive,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-bookmakers'] });
      setOpen(false);
    },
  });

  const columns: Column<BookmakerRow>[] = [
    {
      key: 'name',
      header: 'Buchmacher',
      render: (row) => (
        <span className="font-black italic" style={{ color: row.color ?? '#9BA5B7' }}>
          {row.name}
        </span>
      ),
    },
    {
      key: 'key',
      header: 'Schlüssel',
      render: (row) => <code className="text-ink-dim">{row.key}</code>,
    },
    { key: 'priority', header: 'Priorität', align: 'right', render: (row) => row.priority },
    {
      key: 'active',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.isActive ? 'positive' : 'neutral'}>
          {row.isActive ? 'AKTIV' : 'INAKTIV'}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Buchmacher"
        description="Der Name wird als Schriftzug in der Markenfarbe gerendert; es werden keine fremden Logos gespeichert."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={15} aria-hidden /> Neuer Buchmacher
          </Button>
        }
      />
      {bookmakers.isError ? <ErrorBox error={bookmakers.error} /> : null}
      <DataTable
        columns={columns}
        rows={bookmakers.data?.items ?? []}
        loading={bookmakers.isPending}
        rowKey={(row) => row.id}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Buchmacher anlegen"
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
          <Field
            label="Schlüssel"
            value={form.key}
            onChange={(event) => setForm({ ...form, key: event.target.value })}
          />
          <Field
            label="Name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <Field
            label="Farbe"
            type="color"
            value={form.color}
            onChange={(event) => setForm({ ...form, color: event.target.value })}
          />
          <Field
            label="Website"
            value={form.website}
            onChange={(event) => setForm({ ...form, website: event.target.value })}
            placeholder="https://…"
          />
          <Field
            label="Priorität"
            type="number"
            value={form.priority}
            onChange={(event) => setForm({ ...form, priority: event.target.value })}
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
