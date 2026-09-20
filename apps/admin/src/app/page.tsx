'use client';

import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AdminDashboardDTO } from '@storm-tips/types';
import { api } from '@/lib/api';
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion';
import { ErrorBox, PageHeader, Skeleton } from '@/components/ui';

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'positive' | 'negative' | 'gold';
}): ReactNode {
  return (
    <div className="card px-3 py-3">
      <p className="text-[11px] font-medium tracking-wide text-ink-dim uppercase">{label}</p>
      <p
        className={
          'tabular mt-1 text-[20px] leading-none font-extrabold ' +
          (tone === 'positive'
            ? 'text-won'
            : tone === 'negative'
              ? 'text-lost'
              : tone === 'gold'
                ? 'text-gold-400'
                : 'text-ink')
        }
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-ink-dim">{hint}</p> : null}
    </div>
  );
}

const CHART_TOOLTIP = {
  contentStyle: {
    background: '#121826',
    border: '1px solid #303A4D',
    borderRadius: 12,
    fontSize: 12,
  },
  labelStyle: { color: '#A6B0C2' },
};

export default function DashboardPage(): ReactNode {
  // Recharts animates from JavaScript; the CSS guard cannot reach it.
  const stillCharts = usePrefersReducedMotion();
  const dashboard = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api<AdminDashboardDTO>('/admin/dashboard'),
    refetchInterval: 60_000,
  });

  if (dashboard.isPending) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-[74px]" />
          ))}
        </div>
      </>
    );
  }
  if (dashboard.isError) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <ErrorBox error={dashboard.error} />
      </>
    );
  }

  const data = dashboard.data;
  const numberFormat = new Intl.NumberFormat('en-GB');

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Revenue, users and analysis performance over the last 30 days."
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Revenue today" value={data.revenue.today.formatted} tone="gold" />
        <Kpi label="Revenue this month" value={data.revenue.month.formatted} tone="gold" />
        <Kpi label="MRR" value={data.revenue.mrr.formatted} tone="gold" />
        <Kpi label="Revenue all time" value={data.revenue.total.formatted} />

        <Kpi
          label="Users"
          value={numberFormat.format(data.users.total)}
          hint={`${data.users.new30d} new (30 d) · ${data.users.active30d} active`}
        />
        <Kpi
          label="Subscribers"
          value={numberFormat.format(data.subscribers.total)}
          hint={`${data.subscribers.trialing} on trial`}
          tone="positive"
        />
        <Kpi
          label="Conversion"
          value={`${data.subscribers.conversionRate.toFixed(1)}%`}
          hint={`Churn ${data.subscribers.churnRate.toFixed(1)}%`}
        />
        <Kpi label="Suspended accounts" value={numberFormat.format(data.users.banned)} />

        <Kpi label="Tips published" value={numberFormat.format(data.tips.published)} />
        <Kpi
          label="Win rate (30 d)"
          value={`${data.tips.winRate.toFixed(1)}%`}
          hint={`${data.tips.won} / ${data.tips.lost}`}
          tone="positive"
        />
        <Kpi
          label="ROI (30 d)"
          value={`${data.tips.roi > 0 ? '+' : ''}${data.tips.roi.toFixed(2)}%`}
          tone={data.tips.roi >= 0 ? 'positive' : 'negative'}
        />
        <Kpi
          label="Avg odds"
          value={data.tips.avgOdds.toFixed(2)}
          hint={`${data.tips.pending} open`}
        />
      </section>

      <section className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="card p-3">
          <h2 className="mb-2 text-[13px] font-bold">Revenue per day</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.revenueByDay} margin={{ top: 4, right: 4, left: -16 }}>
                <CartesianGrid stroke="#242C3C" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#7B8699', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fill: '#7B8699', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={46}
                  tickFormatter={(value: number) => `${Math.round(value / 100)}`}
                />
                <Tooltip
                  {...CHART_TOOLTIP}
                  formatter={(value) => [`€${(Number(value ?? 0) / 100).toFixed(2)}`, 'Revenue']}
                  cursor={{ fill: '#1E2637' }}
                />
                <Bar
                  isAnimationActive={!stillCharts}
                  dataKey="amountCents"
                  fill="#FFC93C"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-3">
          <h2 className="mb-2 text-[13px] font-bold">Sign-ups</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.charts.signupsByDay} margin={{ top: 4, right: 4, left: -16 }}>
                <CartesianGrid stroke="#242C3C" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#7B8699', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fill: '#7B8699', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip {...CHART_TOOLTIP} />
                <Line
                  isAnimationActive={!stillCharts}
                  type="monotone"
                  dataKey="count"
                  stroke="#28D8F5"
                  strokeWidth={2}
                  dot={false}
                  name="Sign-ups"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-3 lg:col-span-2">
          <h2 className="mb-2 text-[13px] font-bold">
            Cumulative profit across all analyses (30 days)
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.charts.profitByDay} margin={{ top: 4, right: 4, left: -16 }}>
                <defs>
                  <linearGradient id="adminProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#12E17F" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#12E17F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#242C3C" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#7B8699', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fill: '#7B8699', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={46}
                />
                <Tooltip {...CHART_TOOLTIP} />
                <Area
                  isAnimationActive={!stillCharts}
                  type="monotone"
                  dataKey="cumulativeProfit"
                  name="Cumulative"
                  stroke="#12E17F"
                  strokeWidth={2}
                  fill="url(#adminProfit)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-3 lg:col-span-2">
          <h2 className="mb-2 text-[13px] font-bold">Subscribers per product</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={Object.entries(data.subscribers.byProduct)
                  .filter(([product]) => product !== 'FREE')
                  .map(([product, count]) => ({ product, count }))}
                margin={{ top: 4, right: 4, left: -16 }}
              >
                <CartesianGrid stroke="#242C3C" vertical={false} />
                <XAxis
                  dataKey="product"
                  tick={{ fill: '#A6B0C2', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: '#7B8699', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  allowDecimals={false}
                />
                <Tooltip {...CHART_TOOLTIP} cursor={{ fill: '#1E2637' }} />
                <Bar dataKey="count" name="Subscribers" radius={[3, 3, 0, 0]}>
                  {['VIP', 'EXTRA', 'COMBO', 'FIX_ODDS'].map((product) => (
                    <Cell
                      key={product}
                      fill={
                        product === 'VIP'
                          ? '#FFD65C'
                          : product === 'EXTRA'
                            ? '#28D8F5'
                            : product === 'COMBO'
                              ? '#FFC93C'
                              : '#8B5CF6'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </>
  );
}
