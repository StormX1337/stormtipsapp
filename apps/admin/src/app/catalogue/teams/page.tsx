'use client';

import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Paginated } from '@profit-tips/types';
import { api } from '@/lib/api';
import { DataTable, ErrorBox, PageHeader, Pagination, type Column } from '@/components/ui';

interface TeamRow {
  id: string;
  name: string;
  shortName: string | null;
  code: string | null;
  colorPrimary: string | null;
  logoUrl: string | null;
}

export default function TeamsPage(): ReactNode {
  const [page, setPage] = useState(1);

  const teams = useQuery({
    queryKey: ['admin-teams', page],
    queryFn: () => api<Paginated<TeamRow>>(`/admin/catalogue/teams?page=${page}&limit=25`),
  });

  const columns: Column<TeamRow>[] = [
    {
      key: 'name',
      header: 'Team',
      render: (team) => (
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold text-ink-inverse"
            style={{ background: team.colorPrimary ?? '#2A3140' }}
          >
            {team.code ?? team.name.slice(0, 2).toUpperCase()}
          </span>
          <span className="font-medium">{team.name}</span>
        </div>
      ),
    },
    { key: 'short', header: 'Kurzname', render: (team) => team.shortName ?? '—' },
    { key: 'code', header: 'Kürzel', render: (team) => team.code ?? '—' },
    {
      key: 'logo',
      header: 'Logo',
      render: (team) =>
        team.logoUrl ? (
          <span className="text-[11px] text-ink-dim">hinterlegt</span>
        ) : (
          <span className="text-[11px] text-ink-dim">Monogramm</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Teams"
        description="Ohne hinterlegtes Logo rendert die App ein farbiges Monogramm — es werden keine fremden Wappen ausgeliefert."
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
    </>
  );
}
