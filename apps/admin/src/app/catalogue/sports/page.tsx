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

interface SportRow {
  id: string;
  key: string;
  name: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
}

export default function SportsPage(): ReactNode {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ key: '', name: '', icon: '', sortOrder: '0', isActive: true });

  const sports = useQuery({
    queryKey: ['admin-sports'],
    queryFn: () => api<{ items: SportRow[] }>('/admin/catalogue/sports'),
  });

  const save = useMutation({
    mutationFn: () =>
      api('/admin/catalogue/sports', {
        method: 'POST',
        body: {
          key: form.key,
          name: form.name,
          icon: form.icon || null,
          sortOrder: Number(form.sortOrder),
          isActive: form.isActive,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-sports'] });
      setOpen(false);
    },
  });

  const columns: Column<SportRow>[] = [
    { key: 'name', header: 'Sportart', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'key', header: 'Schlüssel', render: (row) => <code className="text-ink-dim">{row.key}</code> },
    { key: 'order', header: 'Reihenfolge', align: 'right', render: (row) => row.sortOrder },
    {
      key: 'active',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.isActive ? 'positive' : 'neutral'}>{row.isActive ? 'AKTIV' : 'INAKTIV'}</Badge>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Sportarten"
        description="Die Architektur erlaubt beliebig viele Sportarten; jede Liga gehört zu genau einer."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={15} aria-hidden /> Neue Sportart
          </Button>
        }
      />

      {sports.isError ? <ErrorBox error={sports.error} /> : null}

      <DataTable
        columns={columns}
        rows={sports.data?.items ?? []}
        loading={sports.isPending}
        rowKey={(row) => row.id}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Sportart anlegen"
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
            placeholder="handball"
          />
          <Field
            label="Name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <Field
            label="Icon"
            value={form.icon}
            onChange={(event) => setForm({ ...form, icon: event.target.value })}
          />
          <Field
            label="Reihenfolge"
            type="number"
            value={form.sortOrder}
            onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
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
