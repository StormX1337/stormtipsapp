'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import type { Paginated } from '@storm-tips/types';
import { api } from '@/lib/api';
import {
  Button,
  DataTable,
  ErrorBox,
  Field,
  Modal,
  PageHeader,
  Pagination,
  type Column,
} from '@/components/ui';

interface TeamRow {
  id: string;
  name: string;
  shortName: string | null;
  code: string | null;
  colorPrimary: string | null;
  colorSecondary: string | null;
  logoUrl: string | null;
}

interface TeamForm {
  id: string;
  name: string;
  shortName: string;
  code: string;
  logoUrl: string;
  colorPrimary: string;
  colorSecondary: string;
}

/** Falls back to the monogram the app renders when a logo fails to load. */
function Crest({ team }: { team: TeamRow }): ReactNode {
  const [failed, setFailed] = useState(false);
  if (team.logoUrl && !failed) {
    return (
      <img
        src={team.logoUrl}
        alt=""
        className="h-6 w-6 rounded-full object-contain"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold text-ink-inverse"
      style={{ background: team.colorPrimary ?? '#303A4D' }}
    >
      {team.code ?? team.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

export default function TeamsPage(): ReactNode {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<TeamForm | null>(null);

  const teams = useQuery({
    queryKey: ['admin-teams', page],
    queryFn: () => api<Paginated<TeamRow>>(`/admin/catalogue/teams?page=${page}&limit=25`),
  });

  const save = useMutation({
    mutationFn: () =>
      api(`/admin/catalogue/teams/${form?.id}`, {
        method: 'PATCH',
        body: {
          shortName: form?.shortName || null,
          code: form?.code || null,
          // Empty clears the logo, which puts the monogram back.
          logoUrl: form?.logoUrl || null,
          colorPrimary: form?.colorPrimary || null,
          colorSecondary: form?.colorSecondary || null,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-teams'] });
      setForm(null);
    },
  });

  const columns: Column<TeamRow>[] = [
    {
      key: 'name',
      header: 'Team',
      render: (team) => (
        <div className="flex items-center gap-2">
          <Crest team={team} />
          <span className="font-medium">{team.name}</span>
        </div>
      ),
    },
    { key: 'short', header: 'Short name', render: (team) => team.shortName ?? '—' },
    { key: 'code', header: 'Code', render: (team) => team.code ?? '—' },
    {
      key: 'logo',
      header: 'Crest',
      render: (team) =>
        team.logoUrl ? (
          <span className="text-[11px] text-ink-dim">Logo</span>
        ) : (
          <span className="text-[11px] text-ink-dim">Monogram</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (team) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            setForm({
              id: team.id,
              name: team.name,
              shortName: team.shortName ?? '',
              code: team.code ?? '',
              logoUrl: team.logoUrl ?? '',
              colorPrimary: team.colorPrimary ?? '#303A4D',
              colorSecondary: team.colorSecondary ?? '#121826',
            })
          }
        >
          <Pencil size={14} aria-hidden />
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Teams"
        description="A team with no crest renders a coloured monogram instead. Point a team at a logo you hold the rights to and the apps use it everywhere."
      />
      {teams.isError ? <ErrorBox error={teams.error} /> : null}
      <DataTable
        columns={columns}
        rows={teams.data?.items ?? []}
        loading={teams.isPending}
        rowKey={(team) => team.id}
      />
      {teams.data ? (
        <Pagination page={teams.data.page} totalPages={teams.data.totalPages} onChange={setPage} />
      ) : null}

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.name ?? ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Save
            </Button>
          </>
        }
      >
        {form ? (
          <div className="flex flex-col gap-3">
            {save.isError ? <ErrorBox error={save.error} /> : null}

            <div className="flex items-center gap-3 rounded-md bg-bg-card-alt px-3 py-2">
              <Crest
                team={{
                  id: form.id,
                  name: form.name,
                  shortName: form.shortName || null,
                  code: form.code || null,
                  colorPrimary: form.colorPrimary,
                  colorSecondary: form.colorSecondary,
                  logoUrl: form.logoUrl || null,
                }}
              />
              <span className="text-[12px] text-ink-muted">
                {form.logoUrl ? 'Preview — a URL that fails to load falls back here' : 'Monogram'}
              </span>
            </div>

            <Field
              label="Crest URL"
              value={form.logoUrl}
              onChange={(event) => setForm({ ...form, logoUrl: event.target.value })}
              placeholder="https://…/crest.png"
              hint="Use artwork you own or are licensed to use. Leave empty for the monogram."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Short name"
                value={form.shortName}
                onChange={(event) => setForm({ ...form, shortName: event.target.value })}
              />
              <Field
                label="Code"
                maxLength={6}
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                hint="Shown inside the monogram."
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Primary colour"
                type="color"
                value={form.colorPrimary}
                onChange={(event) => setForm({ ...form, colorPrimary: event.target.value })}
              />
              <Field
                label="Secondary colour"
                type="color"
                value={form.colorSecondary}
                onChange={(event) => setForm({ ...form, colorSecondary: event.target.value })}
              />
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
