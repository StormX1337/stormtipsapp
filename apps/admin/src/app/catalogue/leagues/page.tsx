'use client';

import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { LeagueDTO, Paginated } from '@storm-tips/types';
import { api } from '@/lib/api';
import { DataTable, ErrorBox, PageHeader, Pagination, type Column } from '@/components/ui';

export default function LeaguesPage(): ReactNode {
  const [page, setPage] = useState(1);

  const leagues = useQuery({
    queryKey: ['admin-leagues', page],
    queryFn: () => api<Paginated<LeagueDTO>>(`/admin/catalogue/leagues?page=${page}&limit=25`),
  });

  const columns: Column<LeagueDTO>[] = [
    {
      key: 'name',
      header: 'Liga',
      render: (league) => (
        <div className="flex items-center gap-2">
          <span aria-hidden>{league.country?.flagEmoji ?? '🏳️'}</span>
          <div>
            <p className="font-medium">{league.name}</p>
            <p className="text-[11px] text-ink-dim">{league.key}</p>
          </div>
        </div>
      ),
    },
    { key: 'sport', header: 'Sportart', render: (league) => league.sport.name },
    { key: 'country', header: 'Land', render: (league) => league.country?.name ?? '—' },
    { key: 'priority', header: 'Priorität', align: 'right', render: (league) => league.priority },
  ];

  return (
    <>
      <PageHeader
        title="Ligen"
        description="Die Priorität bestimmt die Reihenfolge der Liga-Blöcke im Feed."
      />
      {leagues.isError ? <ErrorBox error={leagues.error} /> : null}
      <DataTable
        columns={columns}
        rows={leagues.data?.items ?? []}
        loading={leagues.isPending}
        rowKey={(league) => league.id}
      />
      {leagues.data ? (
        <Pagination
          page={leagues.data.page}
          totalPages={leagues.data.totalPages}
          onChange={setPage}
        />
      ) : null}
    </>
  );
}
