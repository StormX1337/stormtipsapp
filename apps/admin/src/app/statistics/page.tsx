'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import type { ProductCode, StatsWindow } from '@storm-tips/types';
import { api } from '@/lib/api';
import { Button, DataTable, ErrorBox, PageHeader, Select, type Column } from '@/components/ui';

interface PerformanceRow {
  product: ProductCode;
  settledTips: number;
  won: number;
  lost: number;
  winRate: number;
  roi: number;
  avgOdds: number;
  profit: number;
  bestStreak: number;
}

const WINDOWS: StatsWindow[] = ['D7', 'D30', 'D90', 'M6', 'M12', 'ALL'];

export default function AdminStatisticsPage(): ReactNode {
  const queryClient = useQueryClient();
  const [window, setWindow] = useState<StatsWindow>('D30');

  const performance = useQuery({
    queryKey: ['admin-performance', window],
    queryFn: () =>
      api<{ window: string; items: PerformanceRow[] }>(
        `/admin/dashboard/performance?window=${window}`,
      ),
  });

  const funnel = useQuery({
    queryKey: ['admin-funnel'],
    queryFn: () =>
      api<{ items: { name: string; count: number }[] }>('/admin/dashboard/funnel?days=30'),
  });

  const recompute = useMutation({
    mutationFn: () => api('/admin/ops/statistics/recompute', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-performance'] }),
  });

  const columns: Column<PerformanceRow>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (row) => <span className="font-semibold">{row.product}</span>,
    },
    { key: 'tips', header: 'Settled', align: 'right', render: (row) => row.settledTips },
    {
      key: 'record',
      header: 'Record',
      align: 'right',
      render: (row) => (
        <span className="tabular">
          <span className="text-won">{row.won}</span> /{' '}
          <span className="text-lost">{row.lost}</span>
        </span>
      ),
    },
    {
      key: 'winRate',
      header: 'Win rate',
      align: 'right',
      render: (row) => <span className="tabular">{row.winRate.toFixed(1)}%</span>,
    },
    {
      key: 'roi',
      header: 'ROI',
      align: 'right',
      render: (row) => (
        <span className={'tabular font-bold ' + (row.roi >= 0 ? 'text-won' : 'text-lost')}>
          {row.roi > 0 ? '+' : ''}
          {row.roi.toFixed(2)}%
        </span>
      ),
    },
    {
      key: 'avgOdds',
      header: 'Avg odds',
      align: 'right',
      render: (row) => <span className="tabular">{row.avgOdds.toFixed(2)}</span>,
    },
    {
      key: 'profit',
      header: 'Profit',
      align: 'right',
      render: (row) => (
        <span className={'tabular font-bold ' + (row.profit >= 0 ? 'text-won' : 'text-lost')}>
          {row.profit > 0 ? '+' : ''}
          {row.profit.toFixed(2)}
        </span>
      ),
    },
    { key: 'streak', header: 'Best streak', align: 'right', render: (row) => row.bestStreak },
  ];

  return (
    <>
      <PageHeader
        title="Statistics"
        description="Performance per product, computed from settled analyses only."
        actions={
          <Button
            variant="outline"
            onClick={() => recompute.mutate()}
            disabled={recompute.isPending}
          >
            <RefreshCw size={14} aria-hidden /> Recompute
          </Button>
        }
      />

      <div className="mb-3 max-w-xs">
        <Select
          label="Window"
          value={window}
          onChange={(event) => setWindow(event.target.value as StatsWindow)}
          options={WINDOWS.map((value) => ({ value, label: value }))}
        />
      </div>

      {performance.isError ? <ErrorBox error={performance.error} /> : null}
      {recompute.isSuccess ? (
        <p className="mb-3 rounded-sm bg-accent-500/10 px-3 py-2 text-[12px] text-accent-300">
          Recompute queued.
        </p>
      ) : null}

      <DataTable
        columns={columns}
        rows={performance.data?.items ?? []}
        loading={performance.isPending}
        rowKey={(row) => row.product}
      />

      <h2 className="mt-6 mb-2 text-[14px] font-bold">Product events (30 days)</h2>
      <DataTable
        columns={[
          {
            key: 'name',
            header: 'Event',
            render: (row: { name: string }) => <code>{row.name}</code>,
          },
          {
            key: 'count',
            header: 'Count',
            align: 'right',
            render: (row: { count: number }) => <span className="tabular">{row.count}</span>,
          },
        ]}
        rows={funnel.data?.items ?? []}
        loading={funnel.isPending}
        rowKey={(row) => row.name}
        empty="No analytics events recorded yet"
      />
    </>
  );
}
