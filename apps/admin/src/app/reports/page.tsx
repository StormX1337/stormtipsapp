'use client';

import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import type { ProductCode, StatisticsDTO, StatsWindow } from '@storm-tips/types';
import { api } from '@/lib/api';
import { Button, DataTable, ErrorBox, PageHeader, Select, type Column } from '@/components/ui';

const WINDOWS: StatsWindow[] = ['D7', 'D30', 'D90', 'M6', 'M12', 'ALL'];
const PRODUCTS: (ProductCode | 'ALL')[] = ['ALL', 'FREE', 'VIP', 'EXTRA', 'COMBO', 'FIX_ODDS'];

/** Builds a CSV in the browser — no extra endpoint or dependency required. */
function toCsv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]!);
  const escape = (value: string | number): string => {
    const text = String(value);
    return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    headers.join(';'),
    ...rows.map((row) => headers.map((header) => escape(row[header] ?? '')).join(';')),
  ].join('\n');
}

function download(filename: string, content: string): void {
  // UTF-8 BOM so Excel opens the export with the right encoding.
  const blob = new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage(): ReactNode {
  const [window, setWindow] = useState<StatsWindow>('D30');
  const [product, setProduct] = useState<ProductCode | 'ALL'>('ALL');

  const stats = useQuery({
    queryKey: ['admin-report', product, window],
    queryFn: () => api<StatisticsDTO>(`/statistics?product=${product}&window=${window}`),
  });

  const dayColumns: Column<StatisticsDTO['byDay'][number]>[] = [
    { key: 'date', header: 'Day', render: (row) => row.date },
    { key: 'tips', header: 'Analyses', align: 'right', render: (row) => row.tips },
    { key: 'won', header: 'Won', align: 'right', render: (row) => row.won },
    { key: 'lost', header: 'Lost', align: 'right', render: (row) => row.lost },
    {
      key: 'profit',
      header: 'Profit',
      align: 'right',
      render: (row) => (
        <span className={'tabular ' + (row.profit >= 0 ? 'text-won' : 'text-lost')}>
          {row.profit.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'cumulative',
      header: 'Cumulative',
      align: 'right',
      render: (row) => <span className="tabular font-bold">{row.cumulativeProfit.toFixed(2)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Reports"
        description="Daily, league and market breakdowns with a CSV export for accounting."
        actions={
          <Button
            variant="outline"
            disabled={!stats.data}
            onClick={() => {
              if (!stats.data) return;
              download(
                `storm-tips-${product}-${window}.csv`,
                toCsv(
                  stats.data.byDay.map((row) => ({
                    Day: row.date,
                    Analyses: row.tips,
                    Won: row.won,
                    Lost: row.lost,
                    Profit: row.profit.toFixed(2),
                    Cumulative: row.cumulativeProfit.toFixed(2),
                  })),
                ),
              );
            }}
          >
            <Download size={14} aria-hidden /> Export CSV
          </Button>
        }
      />

      <div className="mb-3 grid max-w-md gap-2 sm:grid-cols-2">
        <Select
          label="Product"
          value={product}
          onChange={(event) => setProduct(event.target.value as ProductCode | 'ALL')}
          options={PRODUCTS.map((value) => ({ value, label: value }))}
        />
        <Select
          label="Window"
          value={window}
          onChange={(event) => setWindow(event.target.value as StatsWindow)}
          options={WINDOWS.map((value) => ({ value, label: value }))}
        />
      </div>

      {stats.isError ? <ErrorBox error={stats.error} /> : null}

      <DataTable
        columns={dayColumns}
        rows={stats.data?.byDay ?? []}
        loading={stats.isPending}
        rowKey={(row) => row.date}
        empty="No settled analyses in this window"
      />

      <h2 className="mt-6 mb-2 text-[14px] font-bold">By league</h2>
      <DataTable
        columns={[
          {
            key: 'league',
            header: 'League',
            render: (row: StatisticsDTO['byLeague'][number]) => row.label,
          },
          { key: 'tips', header: 'Analyses', align: 'right', render: (row) => row.tips },
          {
            key: 'winRate',
            header: 'Win rate',
            align: 'right',
            render: (row) => `${row.winRate.toFixed(1)}%`,
          },
          {
            key: 'roi',
            header: 'ROI',
            align: 'right',
            render: (row) => (
              <span className={'tabular ' + (row.roi >= 0 ? 'text-won' : 'text-lost')}>
                {row.roi.toFixed(2)}%
              </span>
            ),
          },
          {
            key: 'profit',
            header: 'Profit',
            align: 'right',
            render: (row) => <span className="tabular font-bold">{row.profit.toFixed(2)}</span>,
          },
        ]}
        rows={stats.data?.byLeague ?? []}
        loading={stats.isPending}
        rowKey={(row) => row.key}
      />

      <h2 className="mt-6 mb-2 text-[14px] font-bold">By market</h2>
      <DataTable
        columns={[
          {
            key: 'market',
            header: 'Market',
            render: (row: StatisticsDTO['byMarket'][number]) => row.label,
          },
          { key: 'tips', header: 'Analyses', align: 'right', render: (row) => row.tips },
          {
            key: 'avgOdds',
            header: 'Avg odds',
            align: 'right',
            render: (row) => row.avgOdds.toFixed(2),
          },
          {
            key: 'roi',
            header: 'ROI',
            align: 'right',
            render: (row) => (
              <span className={'tabular ' + (row.roi >= 0 ? 'text-won' : 'text-lost')}>
                {row.roi.toFixed(2)}%
              </span>
            ),
          },
          {
            key: 'profit',
            header: 'Profit',
            align: 'right',
            render: (row) => <span className="tabular font-bold">{row.profit.toFixed(2)}</span>,
          },
        ]}
        rows={stats.data?.byMarket ?? []}
        loading={stats.isPending}
        rowKey={(row) => row.key}
      />
    </>
  );
}
